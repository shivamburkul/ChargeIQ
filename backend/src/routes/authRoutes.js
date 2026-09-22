
const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/admin-login', ctrl.adminLogin);
router.get('/me', requireAuth, ctrl.me);
router.put('/me', requireAuth, ctrl.updateProfile);
router.delete('/me', requireAuth, ctrl.deleteAccount);

module.exports = router;

