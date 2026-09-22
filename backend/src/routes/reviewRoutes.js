
const router = require('express').Router();
const ctrl = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/auth');

router.get('/station/:stationId', ctrl.listStationReviews);
router.post('/', requireAuth, ctrl.addReview);
router.delete('/:id', requireAuth, ctrl.deleteReview);

module.exports = router;


