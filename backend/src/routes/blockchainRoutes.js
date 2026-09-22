
const router = require('express').Router();
const ctrl = require('../controllers/blockchainController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/chain', ctrl.getChain);
router.get('/verify', ctrl.verifyChain);
router.get('/booking/:bookingId', ctrl.getBlocksForBooking);

module.exports = router;
