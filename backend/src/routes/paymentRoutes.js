
const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', ctrl.createPayment);
router.get('/booking/:bookingId', ctrl.getPaymentForBooking);
router.get('/:id', ctrl.getPayment);
router.post('/:id/confirm', ctrl.confirmPayment);

module.exports = router;
