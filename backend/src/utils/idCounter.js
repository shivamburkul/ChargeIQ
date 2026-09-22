
const { getDb } = require('../config/firebase');

// Firestore documents normally use random string IDs, but the frontend
// already works with simple numeric ids (in URLs, comparison query params,
// etc.). Rather than touch the frontend, we keep numeric, auto-incrementing
// ids by storing one counter document per collection under
// `_counters/{collectionName}` and incrementing it inside a transaction, so
// concurrent requests never collide.
async function getNextId(collectionName) {
  const db = getDb();
  const ref = db.collection('_counters').doc(collectionName);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(ref, { value: next }, { merge: true });
    return next;
  });
}

// Used only by seed scripts that bulk-insert many rows at once (e.g. the
// station dataset) - reserves a contiguous block of ids in a single
// transaction instead of one transaction per row.
async function reserveIdBlock(collectionName, count) {
  const db = getDb();
  const ref = db.collection('_counters').doc(collectionName);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().value || 0 : 0;
    const next = current + count;
    tx.set(ref, { value: next }, { merge: true });
    return current + 1; // first id in the reserved block
  });
}

module.exports = { getNextId, reserveIdBlock };


