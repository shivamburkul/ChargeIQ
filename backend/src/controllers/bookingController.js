
const { Booking, Station, Vehicle, User, Invoice, Notification } = require('../models');
const { estimateChargingSession } = require('../services/chargingPlannerService');
const { generateInvoicePdf } = require('../services/invoiceService');

const AUTO_CANCEL_GRACE_MINUTES = 60;
// How long a slot stays reserved while payment is in progress before it is
// automatically released back to the station, same idea as an e-commerce
// checkout holding stock for a limited window.
const PAYMENT_WINDOW_MINUTES = 20;

// Advances an in_progress booking to 'completed' (and generates its
// invoice) if its slot end-time has already passed. This is the same
// check getSessionProgress does while being polled, pulled out into its
// own function so downloadInvoice can also call it - previously, if nobody
// had the booking page open with polling running at the exact moment a
// session finished, the booking could stay 'in_progress' forever and no
// invoice would ever be generated, making "download invoice" look broken.
async function completeIfDue(booking) {
  if (booking.status !== 'in_progress') return booking;
  const now = new Date();
  const end = new Date(booking.slotEnd);
  if (now < end) return booking;

  booking.status = 'completed';
  booking.sessionProgressPercent = 100;
  await booking.save();
  await finalizeBookingWithInvoice(booking);
  return booking;
}

exports.createBooking = async (req, res) => {
  try {
    const { stationId, vehicleId, slotStart, targetBatteryPercent, startBatteryPercent } = req.body;
    if (!stationId || !vehicleId || !slotStart || targetBatteryPercent === undefined) {
      return res.status(400).json({ message: 'stationId, vehicleId, slotStart and targetBatteryPercent are required.' });
    }

    const start = new Date(slotStart);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Invalid slot start time.' });
    }
    if (start.getTime() < Date.now() - 60000) {
      return res.status(400).json({ message: 'You can only book a slot for the present or a future time.' });
    }

    const station = await Station.findByPk(stationId);
    if (!station) return res.status(404).json({ message: 'Station not found.' });
    if (station.availableSlots <= 0) return res.status(409).json({ message: 'No slots available at this station right now.' });

    const vehicle = await Vehicle.findOne({ where: { id: Number(vehicleId), userId: req.user.id } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const effectiveStartPercent = startBatteryPercent !== undefined && startBatteryPercent !== null
      ? Number(startBatteryPercent)
      : vehicle.currentBatteryPercent;

    const plan = estimateChargingSession({
      batteryCapacityKwh: vehicle.batteryCapacityKwh,
      currentPercent: effectiveStartPercent,
      targetPercent: targetBatteryPercent,
      vehicleMaxKw: vehicle.maxChargingSpeedKw,
      stationMaxKw: station.maxPowerKw,
      pricePerKwh: station.pricePerKwh,
    });

    const end = new Date(start.getTime() + plan.estimatedDurationMin * 60000);

    const booking = await Booking.create({
      userId: req.user.id,
      stationId: station.id,
      vehicleId: vehicle.id,
      slotStart: start.toISOString(),
      slotEnd: end.toISOString(),
      startBatteryPercent: effectiveStartPercent,
      targetBatteryPercent,
      estimatedDurationMin: plan.estimatedDurationMin,
      estimatedCost: plan.estimatedCost,
      // A slot is not confirmed until the (demo) payment succeeds - this
      // keeps "you can't hold a station without paying" true end-to-end.
      status: 'pending_payment',
      paymentStatus: 'unpaid',
    });

    // The slot is held for the payment window so nobody else can take it
    // out from under this booking while checkout is in progress; if
    // payment is never completed it is released automatically (see
    // autoExpireIfNeeded / the server's expiry watcher).
    station.availableSlots -= 1;
    await station.save();

    vehicle.currentBatteryPercent = effectiveStartPercent;
    vehicle.batteryUpdatedAt = new Date().toISOString();
    await vehicle.save();

    await Notification.create({
      userId: req.user.id,
      title: 'Payment Required',
      message: `Your slot at ${station.name} for ${start.toLocaleString()} is held for ${PAYMENT_WINDOW_MINUTES} minutes. Complete payment to confirm your booking.`,
      type: 'booking',
    });

    res.status(201).json({ booking, plan });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to create booking.' });
  }
};

async function attachRelations(booking) {
  const [station, vehicle, invoice] = await Promise.all([
    Station.findByPk(booking.stationId),
    Vehicle.findByPk(booking.vehicleId),
    Invoice.findOne({ where: { bookingId: booking.id } }),
  ]);
  return { ...booking, station, vehicle, invoice };
}

exports.myBookings = async (req, res) => {
  const bookings = await Booking.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  await Promise.all(bookings.map((b) => autoExpireIfNeeded(b)));
  const enriched = await Promise.all(bookings.map(attachRelations));
  res.json({ bookings: enriched });
};

exports.getBooking = async (req, res) => {
  const { Review } = require('../models');
  const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  await autoExpireIfNeeded(booking);
  const [enriched, review] = await Promise.all([
    attachRelations(booking),
    Review.findOne({ where: { bookingId: booking.id } }),
  ]);
  res.json({ booking: { ...enriched, review } });
};

exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (['completed', 'cancelled'].includes(booking.status)) {
    return res.status(400).json({ message: `Booking already ${booking.status}.` });
  }

  booking.status = 'cancelled';
  booking.cancelReason = req.body.reason || 'Cancelled by user';
  await booking.save();
  await releaseSlot(booking.stationId);

  await Notification.create({
    userId: req.user.id,
    title: 'Booking Cancelled',
    message: `Your booking #${booking.id} has been cancelled.`,
    type: 'booking',
  });

  res.json({ booking });
};

exports.rescheduleBooking = async (req, res) => {
  const { slotStart } = req.body;
  if (!slotStart) return res.status(400).json({ message: 'New slotStart is required.' });

  const newStart = new Date(slotStart);
  if (isNaN(newStart.getTime()) || newStart.getTime() < Date.now() - 60000) {
    return res.status(400).json({ message: 'You can only reschedule to the present or a future time.' });
  }

  const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (['completed', 'cancelled', 'in_progress'].includes(booking.status)) {
    return res.status(400).json({ message: `Cannot reschedule a ${booking.status} booking.` });
  }

  const durationMs = new Date(booking.slotEnd) - new Date(booking.slotStart);
  booking.slotStart = newStart.toISOString();
  booking.slotEnd = new Date(newStart.getTime() + durationMs).toISOString();
  booking.status = 'confirmed';
  await booking.save();

  await Notification.create({
    userId: req.user.id,
    title: 'Booking Rescheduled',
    message: `Your booking #${booking.id} was moved to ${newStart.toLocaleString()}.`,
    type: 'booking',
  });

  res.json({ booking });
};

exports.startCharging = async (req, res) => {
  const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  const expired = await autoExpireIfNeeded(booking);
  if (expired) {
    return res.status(410).json({ message: 'This booking window has expired and was automatically cancelled because charging was never started.' });
  }

  if (!['confirmed'].includes(booking.status)) {
    return res.status(400).json({ message: `Cannot start charging on a ${booking.status} booking.` });
  }

  const now = new Date();
  booking.chargeStartTime = now.toISOString();
  booking.slotEnd = new Date(now.getTime() + booking.estimatedDurationMin * 60000).toISOString();
  booking.status = 'in_progress';
  await booking.save();

  await Notification.create({
    userId: req.user.id,
    title: 'Charging Started',
    message: `Your charging session has started. Estimated completion in ${Math.round(booking.estimatedDurationMin)} minutes.`,
    type: 'booking',
  });

  res.json({ booking });
};

// Simulated charging session progress (time-based, no real hardware attached).
// Only writes back to Firestore when something actually changed (status
// flip, or the rounded progress percentage moved), instead of writing on
// every single poll - cuts write volume without changing behaviour the
// frontend can observe.
exports.getSessionProgress = async (req, res) => {
  const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  const expired = await autoExpireIfNeeded(booking);
  if (expired) {
    return res.json({ bookingId: booking.id, status: 'cancelled', progressPercent: 0, currentBatteryEstimate: booking.startBatteryPercent });
  }

  if (booking.status === 'pending_payment') {
    return res.json({ bookingId: booking.id, status: 'pending_payment', progressPercent: 0, currentBatteryEstimate: booking.startBatteryPercent, waitingForPayment: true });
  }

  if (booking.status === 'confirmed') {
    return res.json({ bookingId: booking.id, status: 'confirmed', progressPercent: 0, currentBatteryEstimate: booking.startBatteryPercent, waitingToStart: true });
  }

  if (booking.status !== 'in_progress') {
    const progressPercent = booking.status === 'completed' ? 100 : 0;
    return res.json({ bookingId: booking.id, status: booking.status, progressPercent, currentBatteryEstimate: booking.status === 'completed' ? booking.targetBatteryPercent : booking.startBatteryPercent });
  }

  const now = new Date();
  const start = new Date(booking.chargeStartTime || booking.slotStart);
  const end = new Date(booking.slotEnd);

  let progress = 0;
  let status = booking.status;

  if (now >= end) {
    progress = 100;
    status = 'completed';
  } else if (now >= start) {
    progress = Math.round(((now - start) / (end - start)) * 100);
  }

  const progressChanged = Math.round(booking.sessionProgressPercent || 0) !== progress;

  if (status !== booking.status) {
    booking.status = status;
    booking.sessionProgressPercent = progress;
    await booking.save();
    if (status === 'completed') {
      await finalizeBookingWithInvoice(booking);
    }
  } else if (progressChanged) {
    booking.sessionProgressPercent = progress;
    await booking.save();
  }

  const currentBatteryEstimate = Math.min(
    booking.targetBatteryPercent,
    booking.startBatteryPercent + ((booking.targetBatteryPercent - booking.startBatteryPercent) * progress) / 100
  );

  res.json({
    bookingId: booking.id,
    status: booking.status,
    progressPercent: progress,
    currentBatteryEstimate: Number(currentBatteryEstimate.toFixed(1)),
  });
};

async function releaseSlot(stationId) {
  const station = await Station.findByPk(stationId);
  if (station) {
    station.availableSlots = Math.min(station.totalSlots, station.availableSlots + 1);
    await station.save();
  }
}

async function autoExpireIfNeeded(booking) {
  if (booking.status === 'pending_payment') {
    const paymentDeadline = new Date(booking.createdAt || booking.slotStart).getTime() + PAYMENT_WINDOW_MINUTES * 60000;
    if (Date.now() < paymentDeadline) return false;

    booking.status = 'cancelled';
    booking.cancelReason = `Automatically cancelled - payment was not completed within ${PAYMENT_WINDOW_MINUTES} minutes.`;
    await booking.save();
    await releaseSlot(booking.stationId);

    await Notification.create({
      userId: booking.userId,
      title: 'Booking Auto-Cancelled',
      message: `Booking #${booking.id} was automatically cancelled because payment wasn't completed in time. The slot has been released.`,
      type: 'booking',
    });

    return true;
  }

  if (booking.status !== 'confirmed') return false;
  const deadline = new Date(booking.slotStart).getTime() + AUTO_CANCEL_GRACE_MINUTES * 60000;
  if (Date.now() < deadline) return false;

  booking.status = 'cancelled';
  booking.cancelReason = 'Automatically cancelled - charging was not started within 1 hour of the reserved slot time.';
  await booking.save();
  await releaseSlot(booking.stationId);

  await Notification.create({
    userId: booking.userId,
    title: 'Booking Auto-Cancelled',
    message: `Booking #${booking.id} was automatically cancelled because charging wasn't started within 1 hour of your reserved slot.`,
    type: 'booking',
  });

  return true;
}

async function finalizeBookingWithInvoice(booking) {
  const existingInvoice = await Invoice.findOne({ where: { bookingId: booking.id } });
  if (existingInvoice) return existingInvoice;

  const { Payment } = require('../models');
  const station = await Station.findByPk(booking.stationId);
  const user = await User.findByPk(booking.userId);
  const vehicle = await Vehicle.findByPk(booking.vehicleId);
  const payment = await Payment.findOne({ where: { bookingId: booking.id, status: 'success' } });
  const energyKwh = Number((
    ((booking.targetBatteryPercent - booking.startBatteryPercent) / 100) * vehicle.batteryCapacityKwh
  ).toFixed(2));

  const pdfMeta = await generateInvoicePdf({
    booking, station, user, energyKwh, pricePerKwh: station.pricePerKwh, payment,
  });

  const invoice = await Invoice.create({
    bookingId: booking.id,
    invoiceNumber: pdfMeta.invoiceNumber,
    energyKwh,
    ratePerKwh: station.pricePerKwh,
    subtotal: pdfMeta.subtotal,
    taxAmount: pdfMeta.taxAmount,
    total: pdfMeta.total,
    pdfFileName: pdfMeta.fileName,
  });

  await releaseSlot(station.id);

  vehicle.currentBatteryPercent = booking.targetBatteryPercent;
  vehicle.batteryUpdatedAt = new Date().toISOString();
  await vehicle.save();

  await Notification.create({
    userId: booking.userId,
    title: 'Charging Session Completed',
    message: `Session at station #${station.id} completed. Invoice ${invoice.invoiceNumber} generated.`,
    type: 'booking',
  });

  return invoice;
}

exports.downloadInvoice = async (req, res) => {
  try {
    const booking = await Booking.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    // Self-heal: a booking only turns 'completed' (and gets its invoice
    // generated) as a side effect of someone polling its progress while
    // the booking detail page is open. If nobody had that page open at
    // the exact moment the session finished, the booking could be stuck
    // showing 'in_progress' forever with no invoice ever created - check
    // and advance it here too, so downloading the invoice always works
    // once a session's time has actually elapsed, regardless of whether
    // anyone was watching it live.
    await completeIfDue(booking);

    if (booking.status !== 'completed') {
      return res.status(404).json({ message: 'Invoice not yet available. The charging session has not finished yet.' });
    }

    let invoice = await Invoice.findOne({ where: { bookingId: booking.id } });
    if (!invoice) {
      invoice = await finalizeBookingWithInvoice(booking);
    }

    const path = require('path');
    const { INVOICES_DIR } = require('../services/invoiceService');
    const { Payment } = require('../models');
    const station = await Station.findByPk(booking.stationId);
    const user = await User.findByPk(booking.userId);
    const vehicle = await Vehicle.findByPk(booking.vehicleId);
    const payment = await Payment.findOne({ where: { bookingId: booking.id, status: 'success' } });
    const energyKwh = Number((((booking.targetBatteryPercent - booking.startBatteryPercent) / 100) * vehicle.batteryCapacityKwh).toFixed(2));
    const pdfMeta = await generateInvoicePdf({ booking, station, user, energyKwh, pricePerKwh: station.pricePerKwh, payment });
    invoice.pdfFileName = pdfMeta.fileName;
    await invoice.save();
    const filePath = path.join(INVOICES_DIR, pdfMeta.fileName);

    res.download(filePath, invoice.pdfFileName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Could not send the invoice file.', error: err.message });
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Could not generate the invoice.', error: err.message });
    }
  }
};

module.exports.autoExpireIfNeeded = autoExpireIfNeeded;
module.exports.finalizeBookingWithInvoice = finalizeBookingWithInvoice;
