
const router = require('express').Router();
const ctrl = require('../controllers/plannerController');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, ctrl.plan);

module.exports = router;


