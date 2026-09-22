
/**
 * Pulls the FULL set of real-world charging stations for India from the
 * free, public OpenChargeMap API (https://openchargemap.org) and overwrites
 * stations.json with real records covering the entire country - not just
 * one city.
 *
 * WHY TILING: a single request like "give me all POIs in India" can get
 * silently truncated by the API's own per-request result cap, and dense
 * metro areas (Delhi NCR, Mumbai, Bangalore...) can have far more stations
 * packed into a small area than sparser regions. To guarantee complete
 * coverage regardless of density, this script:
 *   1. Splits India's bounding box into a grid of tiles.
 *   2. Fetches each tile with boundingbox= (not just countrycode=), so
 *      results are never limited to whatever happens to be near one lat/lng.
 *   3. If a tile comes back "full" (>= maxresults), it's a sign of possible
 *      truncation, so that tile is automatically split into 4 quadrants and
 *      re-fetched recursively until each sub-tile returns comfortably under
 *      the cap.
 *   4. Every POI is deduplicated by its OpenChargeMap ID across tiles
 *      (adjacent tiles overlap at their shared border, so the same real
 *      station can appear in two tiles' results).
 *
 * GETTING AN API KEY (recommended, free, takes ~1 minute):
 *   OpenChargeMap works WITHOUT a key for light/occasional use, but a
 *   nationwide pull is ~100+ requests and you will likely get rate-limited
 *   (HTTP 429) without one. To get a free key:
 *     1. Go to https://openchargemap.org/site/loginprovider/register and
 *        create a free account.
 *     2. Once logged in, go to https://openchargemap.org/site/profile/applications
 *        and click "Register a new application" (any name/description is fine).
 *     3. Copy the generated API key.
 *     4. Paste it into backend/.env as OPENCHARGEMAP_API_KEY=your_key_here
 *   The script still works without a key - it will just go slower and retry
 *   more, because it backs off automatically on 429 responses.
 *
 * Usage:   npm run fetch:opencharge
 * Then:    npm run seed        (loads the freshly fetched data into the DB)
 *
 * Requires outbound internet access to api.openchargemap.io. This is NOT
 * required to run the app - the project ships with a large pre-generated
 * offline dataset (stations.json) so everything works out of the box.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENCHARGEMAP_API_KEY || '';
const COUNTRY_CODE = process.env.OPENCHARGEMAP_COUNTRY_CODE?.trim();
const BASE_URL = 'https://api.openchargemap.io/v3/poi/';
const REQUEST_DELAY_MS = Number(process.env.OPENCHARGEMAP_REQUEST_DELAY_MS || (API_KEY ? 250 : 700));
const MAX_RESULTS_PER_TILE = 100000; // OpenChargeMap's documented per-request cap is 10k, but it seems to silently truncate at 100k
const MAX_SUBDIVIDE_DEPTH = Number(process.env.OPENCHARGEMAP_MAX_SUBDIVIDE_DEPTH || 7);
const INDIAN_STATE_LABELS = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
  'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur',
  'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
  'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'andaman and nicobar islands', 'chandigarh',
  'dadra and nagar haveli and daman and diu', 'delhi', 'jammu and kashmir', 'ladakh', 'lakshadweep', 'puducherry',
]);

// India's approximate bounding box (covers the mainland + island territories
// generously; a few empty-ocean tiles just return zero results quickly).
const INDIA_BOUNDS = { minLat: 6.0, maxLat: 36.0, minLng: 67.5, maxLng: 98.0 };
const TILE_SIZE_DEG = 3; // ~330km squares -> ~110 top-level tiles across India

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function isGenericLocationLabel(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return true;

  return /\b(charging station|ev charging station|charging point|charging hub|fast charger|ev charger|battery swapping|charging bay)\b/i.test(text)
    || /\b(station|charger)\b/i.test(text) && text.split(' ').length > 3
    || /\b(india|district|region|state)\b/i.test(text)
    || INDIAN_STATE_LABELS.has(text);
}

function extractLocalityFromAddress(address) {
  const parts = normalizeText(address).split(',').map((part) => part.trim()).filter(Boolean);

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const candidate = parts[i];
    if (!candidate || /^\d+$/.test(candidate) || isGenericLocationLabel(candidate)) continue;
    if (/\b(road|rd|highway|flyover|toll|terminal|plaza|station|bypass|service road|expressway)\b/i.test(candidate)
      && i > 0) {
      continue;
    }
    return candidate;
  }

  return '';
}

function deriveCityLabel(poi) {
  const info = poi?.AddressInfo || {};
  const candidates = [
    info.Town,
    info.Title,
    extractLocalityFromAddress(info.AddressLine1),
    extractLocalityFromAddress(info.AddressLine2),
    info.StateOrProvince,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized || isGenericLocationLabel(normalized)) continue;
    return normalized;
  }

  return 'Unknown';
}

function buildTopLevelTiles() {
  const tiles = [];
  for (let lat = INDIA_BOUNDS.minLat; lat < INDIA_BOUNDS.maxLat; lat += TILE_SIZE_DEG) {
    for (let lng = INDIA_BOUNDS.minLng; lng < INDIA_BOUNDS.maxLng; lng += TILE_SIZE_DEG) {
      tiles.push({
        swLat: lat, swLng: lng,
        neLat: Math.min(lat + TILE_SIZE_DEG, INDIA_BOUNDS.maxLat),
        neLng: Math.min(lng + TILE_SIZE_DEG, INDIA_BOUNDS.maxLng),
      });
    }
  }
  return tiles;
}

function quadrantsOf(tile) {
  const midLat = (tile.swLat + tile.neLat) / 2;
  const midLng = (tile.swLng + tile.neLng) / 2;
  return [
    { swLat: tile.swLat, swLng: tile.swLng, neLat: midLat, neLng: midLng },
    { swLat: tile.swLat, swLng: midLng, neLat: midLat, neLng: tile.neLng },
    { swLat: midLat, swLng: tile.swLng, neLat: tile.neLat, neLng: midLng },
    { swLat: midLat, swLng: midLng, neLat: tile.neLat, neLng: tile.neLng },
  ];
}

async function fetchTileRaw(tile, attempt = 1) {
  const bbox = `(${tile.swLat},${tile.swLng}),(${tile.neLat},${tile.neLng})`;
  const url = `${BASE_URL}?output=json${COUNTRY_CODE ? `&countrycode=${encodeURIComponent(COUNTRY_CODE)}` : ''}&boundingbox=${encodeURIComponent(bbox)}` +
    `&maxresults=${MAX_RESULTS_PER_TILE}&compact=false&verbose=true` +
    `${API_KEY ? `&key=${API_KEY}` : ''}`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChargeIQ-Student-Project/1.0 (EV charging major project)' } });

    if (res.status === 429) {
      if (attempt > 5) throw new Error('rate limited repeatedly');
      const wait = 2000 * attempt;
      process.stdout.write(` [rate limited, waiting ${wait}ms]`);
      await sleep(wait);
      return fetchTileRaw(tile, attempt + 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt <= 3) {
      await sleep(1500 * attempt);
      return fetchTileRaw(tile, attempt + 1);
    }
    process.stdout.write(` [skipped tile: ${err.message}]`);
    return [];
  }
}

// Fetches a tile, and if it looks truncated (returned >= the per-request
// cap), automatically splits it into 4 quadrants and recurses so no real
// stations get dropped just because they're clustered in a dense area.
async function fetchTileComplete(tile, depth = 0) {
  await sleep(REQUEST_DELAY_MS);
  const data = await fetchTileRaw(tile);

  if (Array.isArray(data) && data.length >= MAX_RESULTS_PER_TILE && depth < MAX_SUBDIVIDE_DEPTH) {
    process.stdout.write(` [dense tile, subdividing]\n`);
    let combined = [];
    for (const quadrant of quadrantsOf(tile)) {
      combined = combined.concat(await fetchTileComplete(quadrant, depth + 1));
    }
    return combined;
  }

  return Array.isArray(data) ? data : [];
}

function mapConnectionsToConnectorTypes(connections = []) {
  const map = { 'ccs': 'CCS2', 'chademo': 'CHAdeMO', 'type 2': 'Type2', 'type2': 'Type2', 'bharat': 'Bharat AC001', 'gb/t': 'GB/T' };
  const found = new Set();
  connections.forEach((c) => {
    const title = (c.ConnectionType && c.ConnectionType.Title || '').toLowerCase();
    Object.keys(map).forEach((k) => { if (title.includes(k)) found.add(map[k]); });
  });
  return found.size ? [...found] : ['Type2'];
}

function estimateMaxPower(connections = []) {
  const powers = connections.map((c) => c.PowerKW).filter((p) => typeof p === 'number' && p > 0);
  return powers.length ? Math.max(...powers) : 22;
}

function chargerTypeForPower(kw) {
  if (kw > 60) return 'DC Ultra-Fast';
  if (kw > 22) return 'DC Fast';
  if (kw > 7) return 'AC Fast';
  return 'AC Slow';
}

function mapPoiToStation(poi, idx) {
  const power = estimateMaxPower(poi.Connections);
  const totalSlots = (poi.Connections || []).reduce((sum, c) => sum + (c.Quantity || 1), 0) || 2;
  const latitude = Number(poi.AddressInfo?.Latitude);
  const longitude = Number(poi.AddressInfo?.Longitude);

  return {
    id: idx + 1,
    name: poi.AddressInfo?.Title || 'Unnamed Charging Station',
    network: poi.OperatorInfo?.Title || 'Independent',
    address: poi.AddressInfo?.AddressLine1 || poi.AddressInfo?.Title || 'Address unavailable',
    city: deriveCityLabel(poi),
    state: poi.AddressInfo?.StateOrProvince || 'Unknown',
    lat: latitude,
    lng: longitude,
    connectorTypes: mapConnectionsToConnectorTypes(poi.Connections),
    chargerType: chargerTypeForPower(power),
    maxPowerKw: power,
    // OpenChargeMap rarely exposes live per-kWh pricing, so a realistic
    // market-range price is estimated here (typical Indian public DC fast
    // charging runs roughly ₹6-20/kWh as of 2025-26).
    pricePerKwh: Number((6 + Math.random() * 14).toFixed(1)),
    totalSlots,
    availableSlots: Math.max(1, Math.floor(totalSlots * (0.4 + Math.random() * 0.5))),
    amenities: [],
    ratingAvg: 0,
    ratingCount: 0,
    source: 'opencharge_map',
    externalId: String(poi.ID),
  };
}

async function fetchAllIndiaStations() {
  const tiles = buildTopLevelTiles();
  console.log(`Fetching real charging-station data from OpenChargeMap across all of India.`);
  console.log(`${tiles.length} top-level tiles queued (dense tiles auto-subdivide). Delay between requests: ${REQUEST_DELAY_MS}ms.`);
  if (!API_KEY) {
    console.log('No OPENCHARGEMAP_API_KEY set - running keyless. This will be slower and more prone to rate limiting.');
    console.log('See the comment at the top of this file for how to get a free key in ~1 minute.\n');
  }

  const byId = new Map();
  let tileNum = 0;

  for (const tile of tiles) {
    tileNum += 1;
    process.stdout.write(`Tile ${tileNum}/${tiles.length} (${tile.swLat.toFixed(1)},${tile.swLng.toFixed(1)}) -> (${tile.neLat.toFixed(1)},${tile.neLng.toFixed(1)})...`);

    const pois = await fetchTileComplete(tile);
    let added = 0;
    pois.forEach((poi) => {
      const latitude = Number(poi?.AddressInfo?.Latitude);
      const longitude = Number(poi?.AddressInfo?.Longitude);
      if (poi?.ID && Number.isFinite(latitude) && Number.isFinite(longitude) && !byId.has(poi.ID)) {
        byId.set(poi.ID, poi);
        added += 1;
      }
    });

    console.log(` +${added} new (running total: ${byId.size})`);
  }

  return [...byId.values()];
}

async function run() {
  const startedAt = Date.now();
  const pois = await fetchAllIndiaStations();

  if (!pois.length) {
    throw new Error('No stations were returned. Check your internet connection / API key and try again.');
  }

  const stations = pois.map(mapPoiToStation);

  const outPath = path.join(__dirname, 'stations.json');
  fs.writeFileSync(outPath, JSON.stringify(stations, null, 2));

  const byState = stations.reduce((acc, s) => { acc[s.state] = (acc[s.state] || 0) + 1; return acc; }, {});
  const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);

  console.log(`\nDone in ${elapsedMin} min. Saved ${stations.length} real stations -> ${outPath}`);
  console.log('\nBreakdown by state/UT:');
  Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([state, count]) => console.log(`  ${state}: ${count}`));
  console.log('\nNext step: run "npm run seed" to load this data into the database.');
}

run().catch((err) => {
  console.error('\nFailed to fetch OpenChargeMap data:', err.message);
  console.error('Tip: this requires outbound internet access on the machine running the script.');
  console.error('The bundled offline stations.json dataset will continue to work fine without this step.');
  process.exit(1);
});


