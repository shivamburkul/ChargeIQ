
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { initFirebase, getDb } = require('../config/firebase');
const { reserveIdBlock } = require('../utils/idCounter');
const stationsData = require('./stations.json');

const BATCH_SIZE = 450; // stay comfortably under Firestore's 500-writes-per-batch limit

async function load() {
  initFirebase();
  const db = getDb();
  const col = db.collection('stations');

  console.log('Removing any previously-imported dataset stations (owner-added stations are left untouched)...');
  const existing = await col.where('source', 'in', ['seed_dataset', 'opencharge_map']).get();
  for (let i = 0; i < existing.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    existing.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  if (existing.size) console.log(`  ...removed ${existing.size} old station(s).`);

  console.log(`Loading ${stationsData.length} stations into Firestore...`);
  const firstId = await reserveIdBlock('stations', stationsData.length);
  const now = new Date().toISOString();

  for (let i = 0; i < stationsData.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = stationsData.slice(i, i + BATCH_SIZE);
    chunk.forEach((s, j) => {
      const id = firstId + i + j;
      const { id: _oldId, ...rest } = s;
      const ref = col.doc(String(id));
      batch.set(ref, {
        ...rest,
        ownerId: null,
        connectorTypes: rest.connectorTypes || [],
        amenities: rest.amenities || [],
        ratingAvg: rest.ratingAvg || 0,
        ratingCount: rest.ratingCount || 0,
        isActive: rest.isActive !== undefined ? rest.isActive : true,
        createdAt: now,
        updatedAt: now,
      });
    });
    await batch.commit();
    console.log(`  ...${Math.min(i + BATCH_SIZE, stationsData.length)}/${stationsData.length} written`);
  }

  console.log('Station import complete.');
  console.log('Restart the backend (npm run dev) so it loads the new stations into its live cache.');
}

load()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to import stations:', err);
    process.exit(1);
  });


