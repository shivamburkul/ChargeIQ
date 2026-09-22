
const { getDb } = require('../config/firebase');
const { getNextId } = require('../utils/idCounter');

// ---------------------------------------------------------------------
// Why this exists
// ---------------------------------------------------------------------
// The station list is the one collection in this app that's genuinely
// large (thousands of rows) AND read on almost every screen (search, map,
// recommendations, comparisons, the owner dashboard, the admin overview).
// Querying Firestore directly on every request - which is what a
// straightforward "port SQLite to Firestore" would do - reads every
// matching document EVERY time, and was the direct cause of the Firestore
// free-tier daily read quota (50k/day) being blown through in one day.
//
// Instead, the whole "stations" collection is kept in memory on the
// server and synced in real time with a single Firestore `onSnapshot`
// listener:
//   - On boot: costs one read per station document, ONCE.
//   - After that: Firestore only sends (and only bills for) documents
//     that actually changed - not the whole collection - so a station
//     owner adding/editing one station costs ~1 read, not thousands.
// All station search/filter/sort logic runs against this in-memory array,
// which also means it's instant and needs zero Firestore composite
// indexes.
// ---------------------------------------------------------------------

const collectionName = 'stations';
let byId = new Map();
let ready = false;
let readyResolvers = [];
let unsubscribe = null;

function toStation(doc) {
  return { id: Number(doc.id), ...doc.data() };
}

function init() {
  if (unsubscribe) return; // already listening
  const db = getDb();
  unsubscribe = db.collection(collectionName).onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = Number(change.doc.id);
        if (change.type === 'removed') {
          byId.delete(id);
        } else {
          byId.set(id, toStation(change.doc));
        }
      });
      if (!ready) {
        ready = true;
        console.log(`Station cache ready: ${byId.size} stations loaded.`);
        readyResolvers.forEach((resolve) => resolve());
        readyResolvers = [];
      }
    },
    (err) => {
      console.error('Station cache listener error:', err.message);
    }
  );
}

function waitUntilReady() {
  if (ready) return Promise.resolve();
  return new Promise((resolve) => readyResolvers.push(resolve));
}

function getAll() {
  return Array.from(byId.values());
}

function getById(id) {
  return byId.get(Number(id)) || null;
}

async function create(data) {
  const id = await getNextId(collectionName);
  const now = new Date().toISOString();
  const record = { ...data, id, createdAt: now, updatedAt: now };
  const { id: _id, ...rest } = record;
  await getDb().collection(collectionName).doc(String(id)).set(rest);
  byId.set(id, record); // update immediately - don't wait for the listener echo
  return record;
}

async function update(id, patch) {
  const existing = byId.get(Number(id));
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  const { id: _id, ...rest } = updated;
  await getDb().collection(collectionName).doc(String(id)).set(rest, { merge: true });
  byId.set(Number(id), updated);
  return updated;
}

async function remove(id) {
  await getDb().collection(collectionName).doc(String(id)).delete();
  byId.delete(Number(id));
}

module.exports = { init, waitUntilReady, getAll, getById, create, update, remove };


