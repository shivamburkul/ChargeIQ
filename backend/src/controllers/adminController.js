
const { User, Booking, Station, Vehicle, Payment } = require('../models');
const stationCache = require('../services/stationCache');
const { getDb } = require('../config/firebase');
const Op = require('../utils/op');
const ttlCache = require('../utils/ttlCache');
const blockchainService = require('../services/blockchainService');
const { deleteAccount } = require('../services/accountDeletionService');
const { generateInvoicePdf } = require('../services/invoiceService');

// Internal source tags (how a station entered the system) mapped to a
// clean, presentable label - admins should see "how was this listed"
// without seeing internal dataset/import identifiers.
const SOURCE_LABELS = {
  owner_added: 'Added by station owner',
  seeded_opencharge_map: 'Imported public dataset',
  seeded: 'Imported public dataset',
  generated: 'Imported public dataset',
};
function friendlySourceLabel(source) {
  return SOURCE_LABELS[source] || (source ? 'Imported public dataset' : 'Platform');
}

// The old version fetched every single row of every collection just to
// count/sum them - the single biggest cause of the Firestore quota being
// exhausted, since this panel polls every few seconds. Firestore's
// count()/sum() aggregation queries cost exactly ONE read each no matter
// how large the collection is, and the station numbers come from the free,
// in-memory station cache instead of Firestore at all. A short TTL cache
// on top means rapid polling still only hits Firestore a few times a
// minute at most.
exports.overview = async (req, res) => {
  try {
    const overview = await ttlCache.getOrSet('admin:overview', 15000, async () => {
    const db = getDb();
    const usersCol = db.collection('users');
    const bookingsCol = db.collection('bookings');
    const reviewsCol = db.collection('reviews');

    const [userCountSnap, ownerCountSnap, bookingCountSnap, completedSnap, reviewCountSnap] = await Promise.all([
      usersCol.where('role', '==', 'user').count().get(),
      usersCol.where('role', '==', 'owner').count().get(),
      bookingsCol.count().get(),
      bookingsCol.where('status', '==', 'completed').count().get(),
      reviewsCol.count().get(),
    ]);

    let totalRevenue = 0;
    if (completedSnap.data().count > 0) {
      try {
        // Avoid Firestore's compound aggregate (where + sum), which needs a
        // composite index to be created manually in the Firebase console
        // and was crashing the whole process with an unhandled rejection
        // whenever that index didn't exist yet. A plain filtered query with
        // a field projection needs no extra index and is summed here
        // instead - a few hundred completed bookings costs nothing.
        const completedRows = await bookingsCol.where('status', '==', 'completed').select('estimatedCost').get();
        totalRevenue = completedRows.docs.reduce((sum, d) => sum + (Number(d.data().estimatedCost) || 0), 0);
      } catch (err) {
        console.error('Could not compute total revenue (non-fatal):', err.message);
        totalRevenue = 0;
      }
    }

    const allStations = stationCache.getAll();
    const sourceBreakdown = allStations.reduce((acc, s) => {
      const label = friendlySourceLabel(s.source);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const paymentsCol = db.collection('payments');
    const [paymentSuccessSnap] = await Promise.all([
      paymentsCol.where('status', '==', 'success').count().get(),
    ]);
    const chain = await blockchainService.getChain();

    return {
      userCount: userCountSnap.data().count,
      ownerCount: ownerCountSnap.data().count,
      stationCount: allStations.length,
      bookingCount: bookingCountSnap.data().count,
      completedBookings: completedSnap.data().count,
      reviewCount: reviewCountSnap.data().count,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      stationSourceBreakdown: sourceBreakdown,
      successfulPayments: paymentSuccessSnap.data().count,
      blockchainBlockCount: chain.length,
    };
  });

    res.json(overview);
  } catch (err) {
    console.error('Admin overview failed (non-fatal):', err.message);
    res.status(500).json({ message: 'Could not load admin overview.', error: err.message });
  }
};

exports.listUsers = async (req, res) => {
  const users = await ttlCache.getOrSet('admin:users', 10000, async () => {
    const rows = await User.findAll({ order: [['createdAt', 'DESC']] });
    return rows.map(({ password, ...rest }) => rest);
  });
  res.json({ users });
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const result = await deleteAccount(req.params.id);
    res.json({ message: 'User removed from platform.', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'User removal failed.' });
  }
};

exports.listAllStations = async (req, res) => {
  const stations = [...stationCache.getAll()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const withOwners = await Promise.all(stations.map(async (station) => {
    const owner = station.ownerId ? await User.findByPk(station.ownerId) : null;
    return {
      ...station,
      owner: owner ? { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone } : null,
      approvalStatus: station.approvalStatus || 'approved',
      sourceLabel: friendlySourceLabel(station.source),
    };
  }));
  res.json({ stations: withOwners });
};

exports.approveStation = async (req, res) => {
  const station = stationCache.getById(Number(req.params.id));
  if (!station) return res.status(404).json({ message: 'Station not found.' });
  const updated = await stationCache.update(station.id, {
    approvalStatus: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: req.user.id,
  });
  res.json({ station: updated });
};

exports.rejectStation = async (req, res) => {
  const station = stationCache.getById(Number(req.params.id));
  if (!station) return res.status(404).json({ message: 'Station not found.' });
  if (station.approvalStatus !== 'pending') {
    return res.status(400).json({ message: 'Only pending stations can be rejected.' });
  }
  await stationCache.remove(station.id);
  ttlCache.invalidate('admin:');
  res.json({ message: 'Station rejected and removed.', stationId: station.id });
};

exports.deactivateStation = async (req, res) => {
  const station = stationCache.getById(Number(req.params.id));
  if (!station) return res.status(404).json({ message: 'Station not found.' });
  const updated = await stationCache.update(station.id, { isActive: !station.isActive });
  res.json({ station: updated });
};

exports.listAllBookings = async (req, res) => {
  const { Vehicle } = require('../models');
  const bookings = await ttlCache.getOrSet('admin:bookings', 10000, async () => {
    const rows = await Booking.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
    return Promise.all(rows.map(async (b) => {
      const station = stationCache.getById(b.stationId);
      const [user, vehicle] = await Promise.all([User.findByPk(b.userId), Vehicle.findByPk(b.vehicleId)]);
      return {
        ...b,
        user: user
          ? { id: user.id, name: user.name, email: user.email }
          : (b.userSnapshot || null),
        station: station
          ? { id: station.id, name: station.name, city: station.city }
          : (b.stationSnapshot || null),
        vehicle: vehicle ? { id: vehicle.id, manufacturer: vehicle.manufacturer, model: vehicle.model, nickname: vehicle.nickname } : null,
      };
    }));
  });
  res.json({ bookings });
};

exports.downloadBookingInvoice = async (req, res) => {
  try {
    const booking = await Booking.findByPk(Number(req.params.bookingId));
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'completed') {
      return res.status(404).json({ message: 'Invoice not yet available - this session has not finished yet.' });
    }

    const station = stationCache.getById(booking.stationId) || await Station.findByPk(booking.stationId);
    const user = await User.findByPk(booking.userId);
    const vehicle = await Vehicle.findByPk(booking.vehicleId);
    const payment = await Payment.findOne({ where: { bookingId: booking.id, status: 'success' } });
    const block = payment ? await blockchainService.findBlockByPaymentId(payment.id) : null;
    if (!station || !user || !vehicle) return res.status(404).json({ message: 'Booking details are incomplete.' });

    const energyKwh = Number((((booking.targetBatteryPercent - booking.startBatteryPercent) / 100) * vehicle.batteryCapacityKwh).toFixed(2));
    const pdfMeta = await generateInvoicePdf({
      booking, station, user, energyKwh, pricePerKwh: station.pricePerKwh, payment, block, includeBlockchain: true,
    });
    res.download(pdfMeta.filePath, pdfMeta.fileName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Could not send the invoice file.', error: err.message });
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Could not generate the admin invoice.', error: err.message });
    }
  }
};

exports.recentActivity = async (req, res) => {
  const activity = await ttlCache.getOrSet('admin:recentActivity', 30000, async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const bookings = await Booking.findAll({ where: { createdAt: { [Op.gte]: since.toISOString() } } });

    const byDay = {};
    bookings.forEach((b) => {
      const day = new Date(b.createdAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return byDay;
  });

  res.json({ bookingsLast30Days: activity });
};
