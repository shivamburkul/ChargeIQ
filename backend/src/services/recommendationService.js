
const { distanceKm } = require('../utils/geo');

/**
 * Explainable, rule-based station recommendation engine.
 *
 * NOTE ON DESIGN: A trained ML ranking model would need historical
 * click/booking-outcome data which does not exist for a fresh project with
 * no real users yet. Rather than fabricate a fake "AI model" trained on
 * invented data, this engine uses a transparent multi-factor weighted
 * scoring formula - the same core approach real recommendation systems use
 * before they accumulate enough interaction data for learned ranking.
 * Every recommendation includes a human-readable explanation of WHY a
 * station was suggested, which is the "explainability" feature requested.
 * A learned model can be swapped in later (see README "Future Scope").
 */

const DEFAULT_WEIGHTS = {
  distance: 0.42,
  availability: 0.16,
  price: 0.14,
  rating: 0.14,
  speed: 0.10,
  connector: 0.04, // small bonus weight; hard filter already applied earlier
};

// Progressive search radii (km). With 600+ stations spread across the
// whole country, ranking every station nationwide by *relative* distance
// (closest-of-all-607 vs farthest-of-all-607) can still surface a station
// hundreds of km away as "relatively close". Instead we first try to find
// enough genuinely local candidates within a tight radius, and only widen
// the search if the area is sparse - so "recommended" always means
// actually near the driver whenever that's possible.
const SEARCH_RADII_KM = [15, 30, 60, 120, 250, 600, Infinity];
const MIN_CANDIDATES = 5;

function normalizeInverse(value, min, max) {
  if (max === min) return 1;
  const clamped = Math.min(Math.max(value, min), max);
  return 1 - (clamped - min) / (max - min);
}

function normalize(value, min, max) {
  if (max === min) return 1;
  const clamped = Math.min(Math.max(value, min), max);
  return (clamped - min) / (max - min);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Treat malformed serialized data as a regular connector value.
      }
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Absolute (not relative) distance score: a station 2km away always scores
// high regardless of how far away the farthest candidate happens to be.
// Decays smoothly to ~0 by roughly 20km.
function absoluteDistanceScore(distance) {
  return 1 / (1 + distance / 4);
}

function isConnectorCompatible(vehicleConnectors, stationConnectors) {
  const vehicleValues = asArray(vehicleConnectors);
  const stationValues = asArray(stationConnectors);
  if (!vehicleValues.filter(Boolean).length || !stationValues.filter(Boolean).length) return true;
  const normalizedStations = stationValues.filter(Boolean).map((c) => String(c).trim().toLowerCase());
  return vehicleValues.filter(Boolean).some((c) => normalizedStations.includes(String(c).trim().toLowerCase()));
}

function applyHardFilters(stations, vehicle, preferences) {
  let candidates = stations.filter((s) => s.isActive !== false && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)));
  if (vehicle && vehicle.connectorTypes) {
    candidates = candidates.filter((s) => isConnectorCompatible(vehicle.connectorTypes, s.connectorTypes));
  }
  if (preferences.maxPricePerKwh) {
    candidates = candidates.filter((s) => s.pricePerKwh <= preferences.maxPricePerKwh);
  }
  if (preferences.minRating) {
    candidates = candidates.filter((s) => s.ratingAvg >= preferences.minRating);
  }
  if (preferences.amenities && preferences.amenities.length) {
    candidates = candidates.filter((s) => preferences.amenities.every((a) => (s.amenities || []).includes(a)));
  }
  if (preferences.chargerType) {
    candidates = candidates.filter((s) => s.chargerType === preferences.chargerType);
  }
  return candidates;
}

/**
 * @param {Object} params
 * @param {{lat:number,lng:number}} params.userLocation
 * @param {Object} params.vehicle - vehicle record (connectorTypes, maxChargingSpeedKw, batteryCapacityKwh)
 * @param {Array} params.stations - candidate station records
 * @param {Object} [params.weights] - optional custom weight overrides
 * @param {Object} [params.preferences] - e.g. { maxPricePerKwh, minRating, amenities: [] }
 */
function recommendStations({ userLocation, vehicle, stations, weights = {}, preferences = {} }) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };

  let filtered = applyHardFilters(stations, vehicle, preferences);
  // Connector metadata is optional in imported and older vehicle records.
  // If it would eliminate every otherwise valid station, keep the vehicle
  // preferences for scoring but do not make recommendations unusable.
  if (!filtered.length && vehicle) {
    filtered = applyHardFilters(stations, null, preferences);
  }
  if (!filtered.length) return [];

  // Progressively widen the search radius around the driver until we have
  // enough genuinely local candidates to rank, instead of ranking the
  // entire nationwide dataset by relative distance.
  let candidates = [];
  let usedRadius = SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1];
  if (userLocation) {
    for (const radius of SEARCH_RADII_KM) {
      candidates = filtered
        .map((s) => ({ station: s, distance: distanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng) }))
        .filter((c) => c.distance <= radius);
      if (candidates.length >= MIN_CANDIDATES || radius === Infinity) {
        usedRadius = radius;
        break;
      }
    }
  } else {
    candidates = filtered.map((s) => ({ station: s, distance: 0 }));
  }

  if (!candidates.length) return [];

  const prices = candidates.map((c) => finiteNumber(c.station.pricePerKwh));
  const ratings = candidates.map((c) => finiteNumber(c.station.ratingAvg));
  const powers = candidates.map((c) => finiteNumber(c.station.maxPowerKw));

  const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
  const minRating = Math.min(...ratings), maxRating = Math.max(...ratings);
  const minPower = Math.min(...powers), maxPower = Math.max(...powers);

  const scored = candidates.map(({ station, distance }) => {
    const price = finiteNumber(station.pricePerKwh);
    const rating = finiteNumber(station.ratingAvg);
    const power = finiteNumber(station.maxPowerKw);
    const totalSlots = Math.max(0, finiteNumber(station.totalSlots));
    const availableSlots = Math.max(0, finiteNumber(station.availableSlots));
    const vehicleConnectors = asArray(vehicle?.connectorTypes);
    const stationConnectors = asArray(station.connectorTypes);
    const distanceScore = absoluteDistanceScore(distance);
    const availabilityScore = totalSlots > 0 ? Math.min(availableSlots / totalSlots, 1) : 0;
    const priceScore = normalizeInverse(price, minPrice, maxPrice);
    const ratingScore = normalize(rating, minRating, maxRating);

    let speedScore = normalize(power, minPower, maxPower);
    const vehicleMaxPower = finiteNumber(vehicle?.maxChargingSpeedKw);
    if (vehicleMaxPower > 0) {
      const effectiveCap = Math.min(power, vehicleMaxPower * 1.5);
      speedScore = normalize(effectiveCap, minPower, Math.max(maxPower, vehicleMaxPower));
    }

    const connectorBonus = vehicleConnectors.length && stationConnectors.length
      && isConnectorCompatible(vehicleConnectors, stationConnectors) ? 1 : 0.6;

    const totalScore =
      w.distance * distanceScore +
      w.availability * availabilityScore +
      w.price * priceScore +
      w.rating * ratingScore +
      w.speed * speedScore +
      w.connector * connectorBonus;

    const factorContributions = [
      { key: 'distance', label: `${distance.toFixed(1)} km away`, weightedValue: w.distance * distanceScore },
      { key: 'availability', label: `${availableSlots}/${totalSlots} slots free`, weightedValue: w.availability * availabilityScore },
      { key: 'price', label: `₹${price}/kWh`, weightedValue: w.price * priceScore },
      { key: 'rating', label: `${rating.toFixed(1)}★ rating`, weightedValue: w.rating * ratingScore },
      { key: 'speed', label: `${power} kW charging speed`, weightedValue: w.speed * speedScore },
    ].sort((a, b) => b.weightedValue - a.weightedValue);

    const topReasons = factorContributions.slice(0, 3).map((f) => f.label);
    const explanation = `Recommended mainly because of ${topReasons.join(', ')}.`;

    return {
      station,
      distanceKm: Number(distance.toFixed(2)),
      score: Number((totalScore * 100).toFixed(1)),
      explanation,
      breakdown: {
        distanceScore: Number(distanceScore.toFixed(2)),
        availabilityScore: Number(availabilityScore.toFixed(2)),
        priceScore: Number(priceScore.toFixed(2)),
        ratingScore: Number(ratingScore.toFixed(2)),
        speedScore: Number(speedScore.toFixed(2)),
      },
    };
  });

  // Distance is still the dominant weighted factor, but for extra
  // predictability we do a final stable sort: within very similar overall
  // scores, nearer stations win ties.
  scored.sort((a, b) => (b.score - a.score) || (a.distanceKm - b.distanceKm));
  return scored;
}

module.exports = { recommendStations, isConnectorCompatible };
