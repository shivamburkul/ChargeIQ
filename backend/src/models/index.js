
const FirestoreModel = require('./firestoreModel');
const stationCache = require('../services/stationCache');

const User = new FirestoreModel('users', { role: 'user', themePref: 'light' });
const Vehicle = new FirestoreModel('vehicles', { currentBatteryPercent: 80, isDefault: false });
const Booking = new FirestoreModel('bookings', { status: 'confirmed', sessionProgressPercent: 0 });
const Review = new FirestoreModel('reviews');
const Notification = new FirestoreModel('notifications', { type: 'system', isRead: false });
const Invoice = new FirestoreModel('invoices');
const Payment = new FirestoreModel('payments', { status: 'created', gateway: 'ChargeIQ DemoPay', currency: 'INR' });

// Station is deliberately NOT a FirestoreModel - see services/stationCache.js
// for why. This facade gives it the same shape (findByPk/findOne/findAll/
// create/update, instances with .save()/.destroy()) so the controllers that
// use it barely had to change, but every read comes from the in-memory
// cache instead of Firestore.
function attachStationMethods(record) {
  if (!record) return record;
  Object.defineProperty(record, 'save', {
    enumerable: false,
    value: async function save() {
      const { id, ...rest } = record;
      const updated = await stationCache.update(id, rest);
      Object.assign(record, updated);
      return record;
    },
  });
  Object.defineProperty(record, 'destroy', {
    enumerable: false,
    value: async function destroy() {
      await stationCache.remove(record.id);
      return true;
    },
  });
  Object.defineProperty(record, 'toJSON', {
    enumerable: false,
    value: function toJSON() {
      return { ...record };
    },
  });
  return record;
}

function matchesWhere(row, where) {
  return Object.entries(where).every(([k, v]) => {
    if (Array.isArray(v)) return v.includes(row[k]);
    return row[k] === v;
  });
}

const Station = {
  async findByPk(id) {
    const s = stationCache.getById(id);
    return s ? attachStationMethods({ ...s }) : null;
  },
  async findOne({ where = {} } = {}) {
    const match = stationCache.getAll().find((s) => matchesWhere(s, where));
    return match ? attachStationMethods({ ...match }) : null;
  },
  async findAll({ where = {}, order } = {}) {
    let rows = stationCache.getAll().filter((s) => matchesWhere(s, where));
    if (order && order.length) {
      const [field, dir] = order[0];
      rows = [...rows].sort((a, b) => {
        const cmp = new Date(a[field] || 0) - new Date(b[field] || 0);
        return dir && dir.toUpperCase() === 'DESC' ? -cmp : cmp;
      });
    }
    return rows.map((s) => attachStationMethods({ ...s }));
  },
  async create(data) {
    const record = await stationCache.create(data);
    return attachStationMethods({ ...record });
  },
  async update(patch, { where = {} } = {}) {
    const matches = stationCache.getAll().filter((s) => matchesWhere(s, where));
    await Promise.all(matches.map((s) => stationCache.update(s.id, patch)));
    return matches.length;
  },
  count(where = {}) {
    return stationCache.getAll().filter((s) => matchesWhere(s, where)).length;
  },
};

module.exports = {
  User,
  Vehicle,
  Station,
  Booking,
  Review,
  Notification,
  Invoice,
  Payment,
};


