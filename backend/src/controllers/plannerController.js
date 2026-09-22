
const { estimateChargingSession } = require('../services/chargingPlannerService');
const { Vehicle, Station } = require('../models');

exports.plan = async (req, res) => {
  try {
    const { vehicleId, stationId, targetBatteryPercent, startBatteryPercent } = req.body;
    const vehicle = await Vehicle.findOne({ where: { id: Number(vehicleId), userId: req.user.id } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    const station = await Station.findByPk(Number(stationId));
    if (!station) return res.status(404).json({ message: 'Station not found.' });

    const effectiveStartPercent = startBatteryPercent !== undefined && startBatteryPercent !== null
      ? Number(startBatteryPercent)
      : vehicle.currentBatteryPercent;

    const plan = estimateChargingSession({
      batteryCapacityKwh: vehicle.batteryCapacityKwh,
      currentPercent: effectiveStartPercent,
      targetPercent: targetBatteryPercent,
      vehicleMaxKw: vehicle.maxChargingSpeedKw,
      stationMaxKw: station.maxPowerKw,
      pricePerKwh: station.pricePerKwh,
    });

    res.json({ plan });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to compute charging plan.' });
  }
};


