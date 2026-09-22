
const { Vehicle } = require('../models');
const evModels = require('../seed/evModels.json');
const { applyBatteryDecay } = require('../utils/batteryDecay');

exports.listCatalog = (req, res) => {
  res.json({ models: evModels });
};

exports.listMyVehicles = async (req, res) => {
  const vehicles = await Vehicle.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
  await Promise.all(vehicles.map(async (v) => {
    if (applyBatteryDecay(v)) await v.save();
  }));
  res.json({ vehicles });
};

exports.addVehicle = async (req, res) => {
  try {
    const { manufacturer, model, variant, batteryCapacityKwh, rangeKm, connectorTypes, maxChargingSpeedKw, nickname, currentBatteryPercent } = req.body;

    if (!manufacturer || !model || !batteryCapacityKwh || !rangeKm || !connectorTypes || !maxChargingSpeedKw) {
      return res.status(400).json({ message: 'Missing required vehicle fields.' });
    }

    const existingCount = await Vehicle.count({ userId: req.user.id });

    const vehicle = await Vehicle.create({
      userId: req.user.id,
      manufacturer,
      model,
      variant: variant || null,
      batteryCapacityKwh,
      rangeKm,
      connectorTypes,
      maxChargingSpeedKw,
      nickname: nickname || null,
      currentBatteryPercent: currentBatteryPercent ?? 80,
      batteryUpdatedAt: new Date().toISOString(),
      isDefault: existingCount === 0,
    });

    res.status(201).json({ vehicle });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add vehicle.', error: err.message });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const fields = ['manufacturer', 'model', 'variant', 'batteryCapacityKwh', 'rangeKm', 'connectorTypes', 'maxChargingSpeedKw', 'nickname', 'currentBatteryPercent'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) vehicle[f] = req.body[f];
    });
    await vehicle.save();
    res.json({ vehicle });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update vehicle.', error: err.message });
  }
};

exports.deleteVehicle = async (req, res) => {
  const vehicle = await Vehicle.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
  await vehicle.destroy();
  res.json({ message: 'Vehicle removed.' });
};

exports.setDefault = async (req, res) => {
  const vehicle = await Vehicle.findOne({ where: { id: Number(req.params.id), userId: req.user.id } });
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
  await Vehicle.update({ isDefault: false }, { where: { userId: req.user.id } });
  vehicle.isDefault = true;
  await vehicle.save();
  res.json({ vehicle });
};


