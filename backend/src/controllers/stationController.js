
const { Station, Review, User, Booking } = require('../models');
const stationCache = require('../services/stationCache');
const { getDb } = require('../config/firebase');
const { recommendStations } = require('../services/recommendationService');
const { parseQuery } = require('../services/nlpSearchService');
const { distanceKm } = require('../utils/geo');
const ttlCache = require('../utils/ttlCache');

function textIncludes(haystack, needle) {
  return (haystack || '').toLowerCase().includes((needle || '').toLowerCase());
}

// Same filtering rules the old SQL `where` clause implemented, just run in
// plain JS against the in-memory station cache instead of Firestore -
// keeps identical behaviour (partial/case-insensitive text match, etc.)
// without spending a single Firestore read per search.
function filterStations(stations, { city, state, chargerType, network, minPrice, maxPrice, minRating, q }) {
  return stations.filter((s) => {
    if (!s.isActive) return false;
    if (s.approvalStatus && s.approvalStatus !== 'approved') return false;
    if (city && !textIncludes(s.city, city)) return false;
    if (state && !textIncludes(s.state, state)) return false;
    if (chargerType && s.chargerType !== chargerType) return false;
    if (network && !textIncludes(s.network, network)) return false;
    if (minPrice && s.pricePerKwh < parseFloat(minPrice)) return false;
    if (maxPrice && s.pricePerKwh > parseFloat(maxPrice)) return false;
    if (minRating && s.ratingAvg < parseFloat(minRating)) return false;
    if (q && q.trim()) {
      const needle = q.trim();
      const anyMatch = [s.name, s.city, s.address, s.network, s.state].some((f) => textIncludes(f, needle));
      if (!anyMatch) return false;
    }
    return true;
  });
}

exports.listStations = async (req, res) => {
  try {
    const {
      city, state, connectorType, chargerType, minPrice, maxPrice, minRating,
      amenities, network, lat, lng, radiusKm, q, page = 1, limit = 3000,
    } = req.query;

    const MAX_LIMIT = 5000;
    const effectiveLimit = Math.min(parseInt(limit) || 3000, MAX_LIMIT);

    let stations = filterStations(stationCache.getAll(), {
      city, state, chargerType, network, minPrice, maxPrice, minRating, q,
    });

    if (connectorType) {
      const wanted = Array.isArray(connectorType) ? connectorType : [connectorType];
      stations = stations.filter((s) => wanted.some((c) => (s.connectorTypes || []).includes(c)));
    }
    if (amenities) {
      const wanted = Array.isArray(amenities) ? amenities : [amenities];
      stations = stations.filter((s) => wanted.every((a) => (s.amenities || []).includes(a)));
    }

    let results;
    if (lat && lng) {
      const uLat = parseFloat(lat), uLng = parseFloat(lng);
      results = stations.map((s) => ({ ...s, distanceKm: Number(distanceKm(uLat, uLng, s.lat, s.lng).toFixed(2)) }));
      if (radiusKm) results = results.filter((s) => s.distanceKm <= parseFloat(radiusKm));
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    } else {
      results = stations;
    }

    const start = (parseInt(page) - 1) * effectiveLimit;
    const paged = results.slice(start, start + effectiveLimit);

    res.json({ total: results.length, page: parseInt(page), limit: effectiveLimit, stations: paged });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stations.', error: err.message });
  }
};

exports.naturalLanguageSearch = async (req, res) => {
  try {
    const { query, lat, lng } = req.query;
    const parsed = parseQuery(query);

    let stations = filterStations(stationCache.getAll(), {
      chargerType: parsed.chargerType,
      network: parsed.networkKeyword,
      maxPrice: undefined,
      minRating: parsed.minRating,
      q: parsed.freeText,
    });
    if (parsed.maxPricePerKwh) stations = stations.filter((s) => s.pricePerKwh <= parsed.maxPricePerKwh);

    if (parsed.connectorTypes.length) {
      stations = stations.filter((s) => parsed.connectorTypes.some((c) => (s.connectorTypes || []).includes(c)));
    }
    if (parsed.amenities.length) {
      stations = stations.filter((s) => parsed.amenities.every((a) => (s.amenities || []).includes(a)));
    }

    let results = stations;
    if (lat && lng) {
      const uLat = parseFloat(lat), uLng = parseFloat(lng);
      results = results.map((s) => ({ ...s, distanceKm: Number(distanceKm(uLat, uLng, s.lat, s.lng).toFixed(2)) }));
      if (parsed.radiusKm) results = results.filter((s) => s.distanceKm <= parsed.radiusKm);
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json({ parsedFilters: parsed, total: results.length, stations: results });
  } catch (err) {
    res.status(500).json({ message: 'Natural language search failed.', error: err.message });
  }
};

exports.recommend = async (req, res) => {
  try {
    const { lat, lng, vehicleId, maxPricePerKwh, minRating, amenities, chargerType } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: 'User location (lat, lng) is required for recommendations.' });
    }

    let vehicle = null;
    if (vehicleId) {
      const { Vehicle } = require('../models');
      vehicle = await Vehicle.findOne({ where: { id: vehicleId, userId: req.user.id } });
    }

    const stations = stationCache.getAll().filter((s) => s.isActive && (!s.approvalStatus || s.approvalStatus === 'approved'));
    const results = recommendStations({
      userLocation: { lat: latitude, lng: longitude },
      vehicle,
      stations,
      preferences: { maxPricePerKwh, minRating, amenities, chargerType },
    });

    res.json({ count: results.length, recommendations: results.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ message: 'Recommendation failed.', error: err.message });
  }
};

exports.getStation = async (req, res) => {
  const station = stationCache.getById(req.params.id);
  if (!station) return res.status(404).json({ message: 'Station not found.' });
  if (station.approvalStatus && station.approvalStatus !== 'approved') {
    return res.status(404).json({ message: 'Station not found.' });
  }

  // Reviews are per-station and only fetched when someone actually opens a
  // station's detail page (never polled), so a direct Firestore query here
  // is fine and keeps reviews genuinely real-time.
  const reviews = await Review.findAll({ where: { stationId: station.id } });
  const withUsers = await Promise.all(reviews.map(async (r) => {
    const user = await User.findByPk(r.userId);
    return { ...r, user: user ? { id: user.id, name: user.name } : null };
  }));

  res.json({ station: { ...station, reviews: withUsers } });
};

exports.compareStations = async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').map((i) => parseInt(i)).filter(Boolean);
    if (ids.length < 2) return res.status(400).json({ message: 'Provide at least 2 station ids to compare (e.g. ?ids=1,2,3).' });
    const stations = ids.map((id) => stationCache.getById(id))
      .filter((s) => s && (!s.approvalStatus || s.approvalStatus === 'approved'));
    res.json({ stations });
  } catch (err) {
    res.status(500).json({ message: 'Comparison failed.', error: err.message });
  }
};

// ---- Owner CRUD ----

exports.createStation = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      ownerId: req.user.id,
      source: 'owner_added',
      isActive: true,
      approvalStatus: 'pending',
      submittedAt: new Date().toISOString(),
    };
    payload.availableSlots = payload.availableSlots ?? payload.totalSlots;
    const station = await Station.create(payload);
    res.status(201).json({ station });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create station.', error: err.message });
  }
};

exports.updateStation = async (req, res) => {
  const station = await Station.findOne({ where: { id: Number(req.params.id), ownerId: req.user.id } });
  if (!station) return res.status(404).json({ message: 'Station not found or not owned by you.' });
  const fields = ['name', 'network', 'address', 'city', 'state', 'lat', 'lng', 'connectorTypes', 'chargerType', 'maxPowerKw', 'pricePerKwh', 'totalSlots', 'availableSlots', 'amenities', 'isActive'];
  fields.forEach((f) => { if (req.body[f] !== undefined) station[f] = req.body[f]; });
  await station.save();
  res.json({ station });
};

exports.deleteStation = async (req, res) => {
  const station = await Station.findOne({ where: { id: Number(req.params.id), ownerId: req.user.id } });
  if (!station) return res.status(404).json({ message: 'Station not found or not owned by you.' });
  await station.destroy();
  res.json({ message: 'Station removed.' });
};

exports.myStations = async (req, res) => {
  const stations = stationCache.getAll()
    .filter((s) => s.ownerId === req.user.id)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  res.json({ stations });
};

exports.ownerBookings = async (req, res) => {
  const stationIds = stationCache.getAll().filter((s) => s.ownerId === req.user.id).map((s) => s.id);
  if (!stationIds.length) return res.json({ bookings: [] });

  const bookings = await ttlCache.getOrSet(`ownerBookings:${req.user.id}`, 10000, async () => {
    const { Vehicle } = require('../models');
    const rows = await Booking.findAll({ where: { stationId: stationIds }, order: [['createdAt', 'DESC']], limit: 100 });
    return Promise.all(rows.map(async (b) => {
      const station = stationCache.getById(b.stationId);
      const [user, vehicle] = await Promise.all([
        User.findByPk(b.userId),
        Vehicle.findByPk(b.vehicleId),
      ]);
      return {
        ...b,
        station: station ? { id: station.id, name: station.name, city: station.city } : null,
        user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone } : null,
        vehicle: vehicle ? { id: vehicle.id, manufacturer: vehicle.manufacturer, model: vehicle.model, nickname: vehicle.nickname } : null,
      };
    }));
  });

  res.json({ bookings });
};

exports.ownerDownloadInvoice = async (req, res) => {
  try {
    const { Invoice } = require('../models');
    const path = require('path');
    const fs = require('fs');
    const { INVOICES_DIR } = require('../services/invoiceService');
    const { finalizeBookingWithInvoice } = require('./bookingController');

    const stationIds = stationCache.getAll().filter((s) => s.ownerId === req.user.id).map((s) => s.id);
    const booking = await Booking.findOne({ where: { id: Number(req.params.bookingId) } });
    if (!booking || !stationIds.includes(booking.stationId)) {
      return res.status(404).json({ message: 'Booking not found at any of your stations.' });
    }
    if (booking.status !== 'completed') {
      return res.status(404).json({ message: 'Invoice not yet available - this session has not finished yet.' });
    }

    let invoice = await Invoice.findOne({ where: { bookingId: booking.id } });
    if (!invoice) {
      // Same self-heal as the driver-facing download: generate it on
      // demand if it was somehow never created automatically.
      invoice = await finalizeBookingWithInvoice(booking);
    }

    const filePath = path.join(INVOICES_DIR, invoice.pdfFileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'The invoice file is missing on the server. Please ask the driver to re-download theirs, which will regenerate it.' });
    }

    res.download(filePath, invoice.pdfFileName, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Could not send the invoice file.', error: err.message });
      }
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: 'Could not download the invoice.', error: err.message });
    }
  }
};

// Station analytics used to fetch every booking row for the station and
// reduce it in JS - fine on SQLite, but on Firestore that's one read per
// booking on every poll. Firestore's count()/sum() aggregation queries
// cost exactly 1 read each NO MATTER how many documents match, so this
// now costs a handful of reads total instead of one per booking - and the
// short TTL cache means repeated polling doesn't even repeat that.
exports.stationAnalytics = async (req, res) => {
  const station = await Station.findOne({ where: { id: Number(req.params.id), ownerId: req.user.id } });
  if (!station) return res.status(404).json({ message: 'Station not found or not owned by you.' });

  const analytics = await ttlCache.getOrSet(`stationAnalytics:${station.id}`, 20000, async () => {
    const db = getDb();
    const base = db.collection('bookings').where('stationId', '==', station.id);
    const statuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled'];

    const [totalSnap, ...statusSnaps] = await Promise.all([
      base.count().get(),
      ...statuses.map((status) => base.where('status', '==', status).count().get()),
    ]);

    const utilizationByStatus = {};
    statuses.forEach((status, i) => {
      const c = statusSnaps[i].data().count;
      if (c > 0) utilizationByStatus[status] = c;
    });

    const completedCount = utilizationByStatus.completed || 0;
    let totalRevenue = 0;
    if (completedCount > 0) {
      try {
        // Same fix as the admin overview: a compound aggregate (two where
        // clauses + sum) needs a manually-created Firestore composite
        // index and was crashing the server when that index didn't exist.
        // A plain filtered query with a field projection needs no extra
        // index.
        const completedRows = await base.where('status', '==', 'completed').select('estimatedCost').get();
        totalRevenue = completedRows.docs.reduce((sum, d) => sum + (Number(d.data().estimatedCost) || 0), 0);
      } catch (err) {
        console.error('Could not compute station revenue (non-fatal):', err.message);
        totalRevenue = 0;
      }
    }

    return {
      stationId: station.id,
      totalBookings: totalSnap.data().count,
      completedBookings: completedCount,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      utilizationByStatus,
      ratingAvg: station.ratingAvg,
      ratingCount: station.ratingCount,
    };
  });

  res.json(analytics);
};

