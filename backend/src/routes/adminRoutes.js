
const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('admin'));

router.get('/overview', ctrl.overview);
router.get('/users', ctrl.listUsers);
router.delete('/users/:id', ctrl.toggleUserStatus);
router.get('/stations', ctrl.listAllStations);
router.patch('/stations/:id/toggle', ctrl.deactivateStation);
router.patch('/stations/:id/approve', ctrl.approveStation);
router.delete('/stations/:id/reject', ctrl.rejectStation);
router.get('/bookings', ctrl.listAllBookings);
router.get('/bookings/:bookingId/invoice', ctrl.downloadBookingInvoice);
router.get('/activity', ctrl.recentActivity);

module.exports = router;
