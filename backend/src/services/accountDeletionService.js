const { admin, getDb } = require('../config/firebase');
const { User } = require('../models');
const stationCache = require('./stationCache');
const ttlCache = require('../utils/ttlCache');

async function updateBookings(db, bookings, snapshotField, snapshot, removedField) {
  await Promise.all(bookings.map((booking) => db.collection('bookings').doc(String(booking.id)).set({
    [snapshotField]: snapshot,
    [removedField]: new Date().toISOString(),
  }, { merge: true })));
}

async function deleteAccount(userId) {
  const user = await User.findByPk(Number(userId));
  if (!user) {
    const error = new Error('User not found.');
    error.status = 404;
    throw error;
  }
  if (user.role === 'admin') {
    const error = new Error('Admin accounts cannot be deleted.');
    error.status = 400;
    throw error;
  }

  const db = getDb();
  const stations = user.role === 'owner'
    ? stationCache.getAll().filter((station) => station.ownerId === user.id)
    : [];
  const stationIds = stations.map((station) => station.id);
  const stationBookingSnapshots = [];
  for (let i = 0; i < stationIds.length; i += 30) {
    const ids = stationIds.slice(i, i + 30);
    const snapshot = await db.collection('bookings').where('stationId', 'in', ids).get();
    stationBookingSnapshots.push(...snapshot.docs.map((doc) => ({ id: Number(doc.id), ...doc.data() })));
  }
  const userBookings = (await db.collection('bookings').where('userId', '==', user.id).get()).docs
    .map((doc) => ({ id: Number(doc.id), ...doc.data() }));

  const userSnapshot = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
  };

  await updateBookings(db, userBookings, 'userSnapshot', userSnapshot, 'userRemovedAt');
  await Promise.all(stationBookingSnapshots.map((booking) => db.collection('bookings').doc(String(booking.id)).set({
    stationSnapshot: stations.find((station) => station.id === booking.stationId) || null,
    stationRemovedAt: new Date().toISOString(),
  }, { merge: true })));

  const collectionsToDelete = [
    ['vehicles', 'userId', user.id],
    ['notifications', 'userId', user.id],
  ];
  await Promise.all(collectionsToDelete.map(async ([collection, field, value]) => {
    const snapshot = await db.collection(collection).where(field, '==', value).get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
  }));

  const reviews = await db.collection('reviews').where('userId', '==', user.id).get();
  await Promise.all(reviews.docs.map((doc) => doc.ref.delete()));

  await Promise.all(stations.map((station) => stationCache.remove(station.id)));
  await user.destroy();

  const firebaseUid = user.firebaseUid || user.uid;
  if (firebaseUid) {
    try {
      await admin.auth().deleteUser(firebaseUid);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  ttlCache.invalidate('admin:');
  ttlCache.invalidate(`ownerBookings:${user.id}`);
  return { role: user.role, removedStationCount: stations.length };
}

module.exports = { deleteAccount };
