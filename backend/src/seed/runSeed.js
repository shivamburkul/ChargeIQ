
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { initFirebase, getDb } = require('../config/firebase');
const { getNextId } = require('../utils/idCounter');

async function run() {
  initFirebase();
  const db = getDb();

  console.log('Checking for an existing admin account...');
  const existing = await db.collection('users').where('role', '==', 'admin').limit(1).get();
  if (!existing.empty) {
    console.log('An admin account already exists - leaving it in place. Nothing to do.');
    return;
  }

  console.log('Creating the platform admin account...');
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const id = await getNextId('users');
  const now = new Date().toISOString();

  await db.collection('users').doc(String(id)).set({
    name: 'Platform Admin',
    email: 'admin@evcharge.com',
    password: passwordHash,
    role: 'admin',
    phone: null,
    themePref: 'light',
    homeLat: null,
    homeLng: null,
    createdAt: now,
    updatedAt: now,
  });

  console.log('\nSeed complete! Admin account created:');
  console.log('  Email    -> admin@evcharge.com');
  console.log('  Password -> Password@123');
  console.log('  (Or use the dedicated admin login screen with username "admin" / password "admin")');
  console.log('\nNext, load the charging station dataset with: npm run seed:stations');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });


