
/**
 * Simulates a vehicle's battery gradually draining over real time between
 * charging sessions, instead of staying pinned at whatever percentage it
 * was last charged to forever. There is no real driving-distance data to
 * base this on in a demo project, so a simple fixed drain rate is used as
 * a documented approximation - just enough for the app to feel "alive"
 * (a car that was charged yesterday should show a lower battery today).
 */
const DRAIN_PERCENT_PER_HOUR = 1.5; // ~ a modest, realistic average idle/usage drain

function applyBatteryDecay(vehicle) {
  const lastUpdate = vehicle.batteryUpdatedAt ? new Date(vehicle.batteryUpdatedAt) : new Date();
  const hoursElapsed = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  if (hoursElapsed <= 0.05) return false; // negligible, skip write

  const drained = Math.max(0, vehicle.currentBatteryPercent - DRAIN_PERCENT_PER_HOUR * hoursElapsed);
  const changed = Math.abs(drained - vehicle.currentBatteryPercent) > 0.1;
  if (changed) {
    vehicle.currentBatteryPercent = Number(drained.toFixed(1));
    vehicle.batteryUpdatedAt = new Date().toISOString();
  }
  return changed;
}

module.exports = { applyBatteryDecay, DRAIN_PERCENT_PER_HOUR };


