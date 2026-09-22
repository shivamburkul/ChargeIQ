
require('dotenv').config();
const { initFirebase } = require('./config/firebase');

// Safety net: a single bad/uncovered async error anywhere in the app used
// to crash the entire Node process (this is exactly what happened with an
// unindexed Firestore aggregate query taking the whole server down). These
// two handlers make sure that can never happen again - any error that
// wasn't already caught by a route's own try/catch is logged here and the
// server keeps running instead of dying.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection (server kept running):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept running):', err?.message || err);
});

// Firebase must be initialized before anything that touches Firestore
// (models, stationCache) is required.
initFirebase();

const app = require('./app');
const stationCache = require('./services/stationCache');
const { Booking } = require('./models');
const { autoExpireIfNeeded } = require('./controllers/bookingController');

const PORT = process.env.PORT || 5000;

// Periodically sweep for bookings that were reserved but never started
// within the grace window, so they auto-cancel and free their slot even
// if no one has the relevant page open to trigger the on-demand check.
// The grace window itself is 60 minutes, so checking every 5 minutes
// (instead of every 60 seconds) is still plenty responsive while cutting
// this background job's Firestore reads by 5x.
function startExpiryWatcher() {
  setInterval(async () => {
    try {
      const [pendingConfirmed, pendingPayment] = await Promise.all([
        Booking.findAll({ where: { status: 'confirmed' } }),
        Booking.findAll({ where: { status: 'pending_payment' } }),
      ]);
      await Promise.all([...pendingConfirmed, ...pendingPayment].map((b) => autoExpireIfNeeded(b)));
    } catch (err) {
      console.error('Expiry watcher error:', err.message);
    }
  }, 5 * 60 * 1000);
}

async function start() {
  try {
    stationCache.init();
    await stationCache.waitUntilReady();
    console.log('Connected to Firebase Firestore.');

    startExpiryWatcher();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Smart EV Charging Platform API running on http://0.0.0.0:${PORT}`);
      console.log(`Health check: http://0.0.0.0:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

