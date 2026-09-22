
const { Booking, Payment, Station, User, Notification } = require('../models');
const paymentService = require('../services/paymentService');
const blockchainService = require('../services/blockchainService');

// Create a payment intent for a booking that is awaiting payment.
// Mirrors real gateways' "create order" step: it fixes the amount server
// side (never trusts a client-supplied amount) and returns a payment id
// the client then confirms against.
exports.createPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: 'bookingId is required.' });

    const booking = await Booking.findOne({ where: { id: Number(bookingId), userId: req.user.id } });
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ message: `This booking is ${booking.status.replace('_', ' ')} and does not need payment.` });
    }

    const station = await Station.findByPk(booking.stationId);

    const payment = await Payment.create({
      bookingId: booking.id,
      userId: req.user.id,
      stationId: booking.stationId,
      stationName: station?.name || null,
      amount: booking.estimatedCost,
      status: 'created',
    });

    res.status(201).json({ payment });
  } catch (err) {
    res.status(500).json({ message: 'Could not start payment.', error: err.message });
  }
};

// Confirms (or declines) a demo card payment, and on success adds an
// immutable block to the blockchain ledger and moves the booking to
// 'confirmed'. This is the only place a booking is allowed to become
// 'confirmed' from 'pending_payment', keeping "you can't get a slot
// without paying" enforced in one spot.
exports.confirmPayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(Number(req.params.id));
    if (!payment || payment.userId !== req.user.id) {
      return res.status(404).json({ message: 'Payment not found.' });
    }
    if (payment.status === 'success') {
      return res.status(400).json({ message: 'This payment has already been completed.' });
    }

    const booking = await Booking.findOne({ where: { id: Number(payment.bookingId), userId: req.user.id } });
    if (!booking) return res.status(404).json({ message: 'Booking for this payment no longer exists.' });
    if (booking.status !== 'pending_payment') {
      return res.status(400).json({ message: `This booking is ${booking.status.replace('_', ' ')}; payment is no longer required.` });
    }

    const { cardNumber, cardName, expiry, cvv } = req.body;
    const outcome = paymentService.chargeCard({ cardNumber, cardName, expiry, cvv }, payment.amount);

    if (!outcome.success) {
      payment.status = 'failed';
      payment.declineReason = outcome.declineReason;
      payment.cardBrand = outcome.cardBrand || null;
      payment.maskedCard = outcome.maskedCard || null;
      payment.attemptedAt = new Date().toISOString();
      await payment.save();
      return res.status(402).json({ message: outcome.declineReason, payment });
    }

    payment.status = 'success';
    payment.transactionId = outcome.transactionId;
    payment.cardBrand = outcome.cardBrand;
    payment.maskedCard = outcome.maskedCard;
    payment.paidAt = outcome.processedAt;
    await payment.save();

    const block = await blockchainService.addBlock({
      type: 'PAYMENT_SETTLEMENT',
      paymentId: payment.id,
      bookingId: booking.id,
      userId: req.user.id,
      stationId: booking.stationId,
      amount: payment.amount,
      currency: 'INR',
      transactionId: payment.transactionId,
      gateway: 'ChargeIQ DemoPay',
    });

    payment.blockIndex = block.index;
    payment.blockHash = block.hash;
    await payment.save();

    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    booking.paymentId = payment.id;
    await booking.save();

    await Notification.create({
      userId: req.user.id,
      title: 'Payment Successful',
      message: `₹${payment.amount} paid via ${payment.cardBrand} ${payment.maskedCard}. Booking #${booking.id} is confirmed and recorded on the blockchain ledger (block #${block.index}).`,
      type: 'payment',
    });

    res.json({ payment, booking, block });
  } catch (err) {
    res.status(500).json({ message: 'Payment could not be processed.', error: err.message });
  }
};

exports.getPayment = async (req, res) => {
  const payment = await Payment.findByPk(Number(req.params.id));
  if (!payment || payment.userId !== req.user.id) return res.status(404).json({ message: 'Payment not found.' });
  res.json({ payment });
};

exports.getPaymentForBooking = async (req, res) => {
  const booking = await Booking.findOne({ where: { id: Number(req.params.bookingId), userId: req.user.id } });
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  const payment = await Payment.findOne({ where: { bookingId: booking.id, status: 'success' } });
  if (!payment) return res.status(404).json({ message: 'No completed payment for this booking yet.' });
  res.json({ payment });
};
