
// A very small in-memory cache with a time-to-live. Several dashboards in
// this app poll the API every few seconds for numbers that don't change
// that fast (platform overview stats, per-station analytics, booking
// lists). Without this, N browser tabs polling every few seconds each
// turn into a fresh, expensive Firestore query every single time - this
// was the direct cause of the Firestore free-tier read quota being
// exhausted in a single day. Wrapping those queries with a short TTL cache
// means no matter how many people/tabs are polling, the real database is
// only hit once per `ttlMs` window per unique key.
const store = new Map();

async function getOrSet(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const value = await fn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

function invalidate(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { getOrSet, invalidate };


