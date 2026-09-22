
const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', ctrl.createBooking);
router.get('/', ctrl.myBookings);
router.get('/:id', ctrl.getBooking);
router.post('/:id/start', ctrl.startCharging);
router.post('/:id/cancel', ctrl.cancelBooking);
router.post('/:id/reschedule', ctrl.rescheduleBooking);
router.get('/:id/progress', ctrl.getSessionProgress);
router.get('/:id/invoice', ctrl.downloadInvoice);

module.exports = router;


