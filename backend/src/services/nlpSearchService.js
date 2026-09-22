
/**
 * Lightweight rule-based "natural language" search parser.
 *
 * Converts a free-text query like:
 *   "fast CCS2 charging near me under 15 per unit with cafe"
 * into structured filters:
 *   { connectorTypes: ["CCS2"], chargerType: "DC Fast",
 *     maxPricePerKwh: 15, amenities: ["Cafe"], radiusKm: null }
 *
 * This is intentionally a transparent keyword/pattern matcher rather than a
 * black-box ML/NLP model - there is no labeled query dataset to train a real
 * intent classifier on, so a rule-based parser is the honest, explainable
 * choice for a major project (see recommendationService.js for rationale).
 */

const CONNECTOR_KEYWORDS = {
  ccs2: 'CCS2',
  ccs: 'CCS2',
  chademo: 'CHAdeMO',
  'type2': 'Type2',
  'type 2': 'Type2',
  'gb/t': 'GB/T',
  gbt: 'GB/T',
  bharat: 'Bharat AC001',
};

const SPEED_KEYWORDS = {
  slow: 'AC Slow',
  normal: 'AC Slow',
  fast: 'DC Fast',
  rapid: 'DC Ultra-Fast',
  ultra: 'DC Ultra-Fast',
  'ac fast': 'AC Fast',
};

const AMENITY_KEYWORDS = {
  cafe: 'Cafe',
  coffee: 'Cafe',
  restroom: 'Restroom',
  toilet: 'Restroom',
  washroom: 'Restroom',
  wifi: 'WiFi',
  parking: 'Parking',
  restaurant: 'Restaurant',
  mall: 'Mall',
  atm: 'ATM',
  lounge: 'Lounge',
};

function parseQuery(text) {
  const q = (text || '').toLowerCase();
  const result = {
    connectorTypes: [],
    chargerType: null,
    maxPricePerKwh: null,
    minRating: null,
    amenities: [],
    radiusKm: null,
    networkKeyword: null,
    freeText: null,
    rawQuery: text,
  };

  let remaining = ` ${q} `;
  const consume = (pattern) => { remaining = remaining.replace(pattern, ' '); };

  // Connector types
  Object.keys(CONNECTOR_KEYWORDS).forEach((kw) => {
    if (q.includes(kw)) { result.connectorTypes.push(CONNECTOR_KEYWORDS[kw]); consume(kw); }
  });
  result.connectorTypes = [...new Set(result.connectorTypes)];

  // Charger speed / type
  Object.keys(SPEED_KEYWORDS).forEach((kw) => {
    if (q.includes(kw)) { result.chargerType = SPEED_KEYWORDS[kw]; consume(kw); }
  });

  // Price: "under 15", "below ₹20", "less than 12 per kwh/unit"
  const priceMatch = q.match(/(?:under|below|less than|<)\s*(?:₹|rs\.?|inr)?\s*(\d+(\.\d+)?)/);
  if (priceMatch) { result.maxPricePerKwh = parseFloat(priceMatch[1]); consume(priceMatch[0]); }

  // Rating: "above 4 star", "4+ rating", "rated 4 and up"
  const ratingMatch = q.match(/(\d(\.\d)?)\s*\+?\s*(?:star|rating|rated)/);
  if (ratingMatch) { result.minRating = parseFloat(ratingMatch[1]); consume(ratingMatch[0]); }

  // Radius: "within 5 km", "near me within 10km"
  const radiusMatch = q.match(/within\s*(\d+(\.\d+)?)\s*km/);
  if (radiusMatch) { result.radiusKm = parseFloat(radiusMatch[1]); consume(radiusMatch[0]); }
  else if (q.includes('near me') || q.includes('nearby')) { result.radiusKm = 10; consume('near me'); consume('nearby'); }

  // Amenities
  Object.keys(AMENITY_KEYWORDS).forEach((kw) => {
    if (q.includes(kw)) { result.amenities.push(AMENITY_KEYWORDS[kw]); consume(kw); }
  });
  result.amenities = [...new Set(result.amenities)];

  // Cheap / budget / premium heuristics (only applied if no explicit price given)
  if (!result.maxPricePerKwh) {
    if (q.includes('cheap') || q.includes('budget') || q.includes('economical')) {
      result.maxPricePerKwh = 12; // heuristic ceiling, tune per market
      consume('cheap'); consume('budget'); consume('economical');
    }
  }

  // Network keyword (e.g. "Tata Power", "Statiq", "ChargeZone")
  const knownNetworks = ['tata power', 'statiq', 'chargezone', 'ather grid', 'zeon', 'bpcl', 'iocl', 'jio-bp'];
  const foundNetwork = knownNetworks.find((n) => q.includes(n));
  if (foundNetwork) { result.networkKeyword = foundNetwork; consume(foundNetwork); }

  // Whatever text is left after stripping every recognized keyword/phrase
  // is treated as free text - typically a city or station name - and used
  // as a fallback filter so searches like "Pune" or "Mumbai Airport Road"
  // actually narrow the results instead of matching everything.
  const stopWords = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'or', 'charger', 'charging', 'station', 'stations', 'me', 'near', 'in', 'at', 'per', 'kwh', 'unit']);
  const leftover = remaining
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stopWords.has(w))
    .join(' ')
    .trim();
  if (leftover) result.freeText = leftover;

  return result;
}

module.exports = { parseQuery };


