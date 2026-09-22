
const router = require('express').Router();
const ctrl = require('../controllers/stationController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public / user-facing
router.get('/', ctrl.listStations);
router.get('/search/nlp', ctrl.naturalLanguageSearch);
router.post('/recommend', requireAuth, ctrl.recommend);
router.get('/compare', ctrl.compareStations);
router.get('/:id', ctrl.getStation);

// Owner-facing
router.get('/owner/mine', requireAuth, requireRole('owner', 'admin'), ctrl.myStations);
router.get('/owner/bookings', requireAuth, requireRole('owner', 'admin'), ctrl.ownerBookings);
router.get('/owner/bookings/:bookingId/invoice', requireAuth, requireRole('owner', 'admin'), ctrl.ownerDownloadInvoice);
router.post('/', requireAuth, requireRole('owner', 'admin'), ctrl.createStation);
router.put('/:id', requireAuth, requireRole('owner', 'admin'), ctrl.updateStation);
router.delete('/:id', requireAuth, requireRole('owner', 'admin'), ctrl.deleteStation);
router.get('/:id/analytics', requireAuth, requireRole('owner', 'admin'), ctrl.stationAnalytics);

module.exports = router;


