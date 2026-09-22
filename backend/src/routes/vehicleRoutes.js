
const router = require('express').Router();
const ctrl = require('../controllers/vehicleController');
const { requireAuth } = require('../middleware/auth');

router.get('/catalog', ctrl.listCatalog); // public reference dataset
router.get('/', requireAuth, ctrl.listMyVehicles);
router.post('/', requireAuth, ctrl.addVehicle);
router.put('/:id', requireAuth, ctrl.updateVehicle);
router.delete('/:id', requireAuth, ctrl.deleteVehicle);
router.patch('/:id/default', requireAuth, ctrl.setDefault);

module.exports = router;


