
/**
 * Charging Planner
 * Estimates energy needed, charging duration and cost for a given
 * vehicle + station combination, using real physics-based formulas
 * (not simulated/random numbers).
 *
 * Simplifications documented for transparency (appropriate for a BE major
 * project - a full charging-curve model would require proprietary battery
 * management data that manufacturers don't publish):
 *  - Charging power is capped at min(station max power, vehicle max
 *    acceptance rate).
 *  - A flat 90% conversion efficiency factor approximates real-world losses
 *    (cabling, AC/DC conversion, battery management overhead).
 *  - Linear charging rate is assumed rather than the true tapering curve
 *    batteries exhibit above ~80% state of charge.
 */

const EFFICIENCY_FACTOR = 0.9;

function estimateChargingSession({ batteryCapacityKwh, currentPercent, targetPercent, vehicleMaxKw, stationMaxKw, pricePerKwh }) {
  if (targetPercent <= currentPercent) {
    throw new Error('Target battery percentage must be greater than the current percentage.');
  }

  const percentToAdd = targetPercent - currentPercent;
  const energyNeededKwh = (percentToAdd / 100) * batteryCapacityKwh;

  const effectivePowerKw = Math.min(vehicleMaxKw, stationMaxKw) * EFFICIENCY_FACTOR;
  const durationHours = energyNeededKwh / effectivePowerKw;
  const durationMinutes = durationHours * 60;

  const estimatedCost = energyNeededKwh * pricePerKwh;

  return {
    energyNeededKwh: Number(energyNeededKwh.toFixed(2)),
    effectivePowerKw: Number(effectivePowerKw.toFixed(2)),
    estimatedDurationMin: Number(durationMinutes.toFixed(1)),
    estimatedCost: Number(estimatedCost.toFixed(2)),
    assumptions: `Assumes ${(EFFICIENCY_FACTOR * 100)}% charging efficiency and a linear charge rate capped at min(vehicle ${vehicleMaxKw}kW, station ${stationMaxKw}kW).`,
  };
}

module.exports = { estimateChargingSession };


