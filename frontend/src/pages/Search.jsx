
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MapView from '../components/MapView';
import StationCard from '../components/StationCard';
import Spinner from '../components/Spinner';
import FadeIn from '../components/FadeIn';
import useGeolocation from '../hooks/useGeolocation';
import { stationApi, vehicleApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

const CONNECTOR_OPTIONS = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', 'Bharat AC001'];
const CHARGER_TYPES = ['AC Slow', 'AC Fast', 'DC Fast', 'DC Ultra-Fast'];
const AMENITIES = ['Cafe', 'Restroom', 'WiFi', 'Parking', 'Restaurant', 'Mall', 'ATM', 'Lounge'];

export default function Search() {
  const { user } = useAuth();
  const { location, status: geoStatus, fallback: geoFallback } = useGeolocation();
  const [params, setParams] = useSearchParams();

  const [mode, setMode] = useState('browse'); // 'browse' | 'ai' | 'nlp'
  const [stations, setStations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [nlpResults, setNlpResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nlQuery, setNlQuery] = useState('');
  const [highlighted, setHighlighted] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [mobilePanel, setMobilePanel] = useState(null);
  const [recommendationError, setRecommendationError] = useState('');

  const [filters, setFilters] = useState({
    city: '', connectorType: '', chargerType: '', minPrice: '', maxPrice: '', minRating: '', amenities: [],
  });
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  const CARDS_PER_PAGE = 60;

  useEffect(() => {
    if (user) {
      vehicleApi.list().then((res) => {
        setVehicles(res.data.vehicles);
        const def = res.data.vehicles.find((v) => v.isDefault) || res.data.vehicles[0];
        if (def) setSelectedVehicleId(String(def.id));
      }).catch(() => {});
    }
  }, [user]);

  async function loadBrowse() {
    setLoading(true);
    try {
      const query = { ...filters };
      if (filters.amenities.length) query.amenities = filters.amenities;
      if (location) { query.lat = location.lat; query.lng = location.lng; }
      if (nearMeOnly && location) query.radiusKm = 20;
      Object.keys(query).forEach((k) => { if (query[k] === '' || (Array.isArray(query[k]) && !query[k].length)) delete query[k]; });
      const res = await stationApi.list(query);
      setStations(res.data.stations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (location) loadBrowse(); }, [location, nearMeOnly]); // eslint-disable-line

  async function runRecommend() {
    // Guard against firing before geolocation has resolved — this was the
    // main cause of "useless" recommendations: while still loading, there
    // was no real fix yet and the request silently fell back to the
    // geographic center of India (Madhya Pradesh), hundreds/thousands of km
    // from the actual driver, so "nearest stations" were nowhere close.
    if (geoStatus === 'loading') {
      setRecommendationError('Still finding your location — please try again in a moment.');
      return;
    }
    setLoading(true);
    setMode('ai');
    setRecommendationError('');
    try {
      // Always use the hook's own resolved location or its matching
      // fallback (Mumbai) — never an unrelated hardcoded coordinate — so
      // "near me" is always consistent with what the map/browse mode uses.
      const loc = location || geoFallback;
      const payload = {
        lat: loc.lat,
        lng: loc.lng,
      };
      if (selectedVehicleId) payload.vehicleId = Number(selectedVehicleId);
      if (filters.maxPrice) payload.maxPricePerKwh = Number(filters.maxPrice);
      if (filters.minRating) payload.minRating = Number(filters.minRating);
      if (filters.chargerType) payload.chargerType = filters.chargerType;
      const res = await stationApi.recommend(payload);
      setRecommendations(res.data.recommendations);
    } catch (err) {
      setRecommendationError(err.response?.data?.message || 'Could not load personalized recommendations.');
    } finally {
      setLoading(false);
    }
  }

  async function runNlpSearch(e) {
    e?.preventDefault();
    if (!nlQuery.trim()) return;
    setLoading(true);
    setMode('nlp');
    try {
      const res = await stationApi.nlpSearch(nlQuery, location?.lat, location?.lng);
      setNlpResults(res.data);
    } finally {
      setLoading(false);
    }
  }

  function toggleCompare(id) {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev));
  }

  function toggleAmenity(a) {
    setFilters((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));
  }

  const activeList = useMemo(() => {
    if (mode === 'ai') return recommendations.map((r) => ({ ...r.station, distanceKm: r.distanceKm, score: r.score, explanation: r.explanation }));
    if (mode === 'nlp') return nlpResults?.stations || [];
    return stations;
  }, [mode, stations, recommendations, nlpResults]);

  // The map renders the full result set (leaflet.markercluster handles
  // thousands of markers smoothly), but rendering thousands of full
  // StationCard components in the DOM at once would make the page sluggish
  // - so the card grid below the map is paginated client-side instead.
  useEffect(() => { setVisibleCount(CARDS_PER_PAGE); }, [activeList]);
  const visibleList = useMemo(() => activeList.slice(0, visibleCount), [activeList, visibleCount]);

  const mapStations = activeList;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        <div className="search-mobile-controls lg:hidden">
          <button type="button" onClick={() => setMobilePanel((panel) => panel === 'recommend' ? null : 'recommend')} className="btn-secondary flex-1 !py-2 text-sm">
            Smart recommendations
          </button>
          <button type="button" onClick={() => setMobilePanel((panel) => panel === 'filters' ? null : 'filters')} className="btn-secondary flex-1 !py-2 text-sm">
            Filters
          </button>
        </div>
        <aside className="lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-20 lg:pr-1">
          <div className="card p-4">
            <h2 className="font-display font-semibold mb-3">Describe what you need</h2>
            <form onSubmit={runNlpSearch} className="space-y-2">
              <input
                value={nlQuery}
                onChange={(e) => setNlQuery(e.target.value)}
                className="input-field text-sm"
                placeholder='e.g. "Pune" or "fast charger under ₹12 with a cafe"'
              />
              <button type="submit" className="btn-primary w-full !py-2 text-sm">Search</button>
              {mode === 'nlp' && (
                <button type="button" onClick={() => { setMode('browse'); setNlQuery(''); loadBrowse(); }} className="btn-secondary w-full !py-1.5 text-xs">Clear search, show all stations</button>
              )}
            </form>
            {mode === 'nlp' && nlpResults && (
              <div className="mt-2 text-xs text-slate-500">
                Showing: {nlpResults.parsedFilters.connectorTypes.join(', ') || 'any connector'}, up to {nlpResults.parsedFilters.maxPricePerKwh ? `₹${nlpResults.parsedFilters.maxPricePerKwh}/kWh` : 'any price'}
              </div>
            )}
          </div>

          {user && vehicles.length > 0 && (
            <div className={`card p-4 ${mobilePanel === 'recommend' ? '' : 'search-panel-collapsible'}`}>
              <h2 className="font-display font-semibold mb-3">Smart recommendations</h2>
              <label className="text-xs text-slate-500">Vehicle</label>
              <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="input-field text-sm mt-1 mb-3">
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname || `${v.manufacturer} ${v.model}`}</option>)}
              </select>
              <button onClick={runRecommend} disabled={geoStatus === 'loading'} className="btn-primary w-full !py-2 text-sm">
                {geoStatus === 'loading' ? 'Locating you…' : '✨ Get personalized picks'}
              </button>
              {recommendationError && <p className="text-xs text-red-500 mt-2">{recommendationError}</p>}
              {geoStatus === 'denied' && mode === 'ai' && (
                <p className="text-xs text-slate-400 mt-2">Location access was denied, so picks are centered on Mumbai. Enable location for accurate nearby results.</p>
              )}
              {mode === 'ai' && (
                <button type="button" onClick={() => { setMode('browse'); loadBrowse(); }} className="btn-secondary w-full !py-1.5 text-xs mt-2">Show all stations</button>
              )}
            </div>
          )}

          <div className={`card p-4 ${mobilePanel === 'filters' ? '' : 'search-panel-collapsible'}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold">Filters</h2>
              <button onClick={() => { setMode('browse'); loadBrowse(); }} className="text-xs text-brand-600 font-medium">Browse all</button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2 text-sm py-1">
                <input type="checkbox" checked={nearMeOnly} onChange={(e) => setNearMeOnly(e.target.checked)} className="accent-brand-600" />
                Show only stations near me (within 20 km)
              </label>
              <div>
                <label className="text-xs text-slate-500">City</label>
                <input value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} className="input-field mt-1" placeholder="Mumbai, Pune..." />
              </div>
              <div>
                <label className="text-xs text-slate-500">Charger type</label>
                <select value={filters.chargerType} onChange={(e) => setFilters((f) => ({ ...f, chargerType: e.target.value }))} className="input-field mt-1">
                  <option value="">Any</option>
                  {CHARGER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Connector type</label>
                <select value={filters.connectorType} onChange={(e) => setFilters((f) => ({ ...f, connectorType: e.target.value }))} className="input-field mt-1">
                  <option value="">Any</option>
                  {CONNECTOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Min ₹/kWh</label>
                  <input type="number" value={filters.minPrice} onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))} className="input-field mt-1" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Max ₹/kWh</label>
                  <input type="number" value={filters.maxPrice} onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))} className="input-field mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Min rating</label>
                <select value={filters.minRating} onChange={(e) => setFilters((f) => ({ ...f, minRating: e.target.value }))} className="input-field mt-1">
                  <option value="">Any</option>
                  {[3, 3.5, 4, 4.5].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Amenities</label>
                <div className="flex flex-wrap gap-1.5">
                  {AMENITIES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAmenity(a)}
                      className={`badge border ${filters.amenities.includes(a) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { setMode('browse'); loadBrowse(); }} className="btn-secondary w-full !py-2 text-sm">Apply filters</button>
            </div>
          </div>

          {compareIds.length >= 2 && (
            <a href={`/compare?ids=${compareIds.join(',')}`} className="btn-primary w-full !py-2.5 text-sm block text-center">
              Compare {compareIds.length} stations →
            </a>
          )}
        </aside>

        {/* Main content: map stays fixed in place, only the results list
            below it scrolls within its own bounded box so the sidebar and
            map never move as you browse results. */}
        <main className="flex-1 min-w-0">
          <MapView
            stations={mapStations}
            center={location ? [location.lat, location.lng] : undefined}
            highlightedId={highlighted}
            onMarkerClick={(s) => setHighlighted(s.id)}
            heightClass="h-[380px] mb-5"
          />

          <div className="flex items-center justify-between mb-4">
            <AnimatePresence mode="wait">
              <motion.h2
                key={mode}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22 }}
                className="font-display font-semibold text-lg"
              >
                {mode === 'ai' ? 'Recommended for you' : mode === 'nlp' ? 'Search results' : 'All stations'}
                <span className="text-slate-400 font-normal text-sm ml-2">({activeList.length})</span>
              </motion.h2>
            </AnimatePresence>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><Spinner size={32} /></div>
          ) : activeList.length === 0 ? (
            <FadeIn>
              <div className="card p-10 text-center text-slate-500">No stations match these filters yet. Try widening your search.</div>
            </FadeIn>
          ) : (
            <div className="-mr-1">
              <div className="grid grid-cols-1 min-w-0 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-4">
                {visibleList.map((s) => (
                  <StationCard
                    key={s.id}
                    station={s}
                    score={s.score}
                    explanation={s.explanation}
                    selectable
                    selected={compareIds.includes(s.id)}
                    onToggleSelect={toggleCompare}
                  />
                ))}
              </div>
              {visibleCount < activeList.length && (
                <div className="flex justify-center pb-6">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setVisibleCount((c) => c + CARDS_PER_PAGE)}
                    className="btn-secondary !py-2 px-6 text-sm"
                  >
                    Load more ({activeList.length - visibleCount} remaining)
                  </motion.button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
