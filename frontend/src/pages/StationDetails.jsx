
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { stationApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import MapView from '../components/MapView';
import BookingModal from '../components/BookingModal';
import Spinner from '../components/Spinner';
import StarRating from '../components/StarRating';
import FadeIn from '../components/FadeIn';
import { StaggerList, StaggerItem } from '../components/StaggerList';
import useGeolocation from '../hooks/useGeolocation';
import useLiveTracking from '../hooks/useLiveTracking';
import { fetchDrivingRoute } from '../api/routing';

export default function StationDetails() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { location } = useGeolocation();
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(params.get('book') === '1');

  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const live = useLiveTracking();
  const rerouteTimer = useRef(null);

  async function load() {
    setLoading(true);
    const res = await stationApi.get(id);
    setStation(res.data.station);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function getDirections(from) {
    if (!station) return;
    setRouteLoading(true);
    setRouteError('');
    try {
      const r = await fetchDrivingRoute(from, { lat: station.lat, lng: station.lng });
      setRoute(r);
    } catch (err) {
      setRouteError('Could not fetch directions right now — routing needs an internet connection.');
    } finally {
      setRouteLoading(false);
    }
  }

  function startTracking() {
    live.start();
  }

  function stopTracking() {
    live.stop();
    if (rerouteTimer.current) clearInterval(rerouteTimer.current);
  }

  // While live tracking is on, periodically re-fetch the route from the
  // driver's current position so the line and ETA stay up to date - an
  // approximation of turn-by-turn rerouting using the free OSRM service.
  useEffect(() => {
    if (!live.tracking || !live.position) return undefined;
    getDirections(live.position);
    rerouteTimer.current = setInterval(() => getDirections(live.position), 20000);
    return () => clearInterval(rerouteTimer.current);
  }, [live.tracking]); // eslint-disable-line

  useEffect(() => {
    if (live.tracking && live.position) getDirections(live.position);
  }, [live.position]); // eslint-disable-line

  if (loading || !station) {
    return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;
  }

  const availabilityPct = station.totalSlots ? Math.round((station.availableSlots / station.totalSlots) * 100) : 0;
  const mapCenter = live.tracking && live.position ? [live.position.lat, live.position.lng] : (location ? [location.lat, location.lng] : [station.lat, station.lng]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn>
        <Link to="/search" className="text-sm text-slate-500 hover:text-brand-600">← Back to search</Link>
      </FadeIn>

      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <div>
          <FadeIn delay={0.05}>
            <h1 className="font-display text-2xl font-bold">{station.name}</h1>
            <p className="text-slate-500 mt-1">{station.address}, {station.city}</p>
            {station.ratingCount > 0 && (
              <p className="text-sm mt-1">★ {station.ratingAvg.toFixed(1)} · {station.ratingCount} reviews</p>
            )}
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{station.chargerType}</span>
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{station.maxPowerKw} kW max</span>
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">₹{station.pricePerKwh}/kWh</span>
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{station.network}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {station.connectorTypes.map((c) => (
                <span key={c} className="badge bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 text-slate-600 dark:text-slate-300">{c}</span>
              ))}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-1.5">Amenities</h3>
              {station.amenities?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {station.amenities.map((a) => <span key={a} className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{a}</span>)}
                </div>
              ) : <p className="text-xs text-slate-500">No amenities listed for this station.</p>}
            </div>
          </FadeIn>

          <FadeIn delay={0.18}>
            <div className="mt-4 card p-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Slot availability</span>
                <span className="font-medium">{station.availableSlots}/{station.totalSlots} free</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full bg-brand-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${availabilityPct}%` }}
                  transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                />
              </div>
            </div>
          </FadeIn>

          {/* Directions / live tracking */}
          <FadeIn delay={0.24}>
            <div className="mt-4 card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Directions</h3>
                {route && <span className="text-xs text-slate-500">{route.distanceKm} km · {route.durationMin} min</span>}
              </div>
              {routeError && <p className="text-xs text-red-500 mb-2">{routeError}</p>}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => location && getDirections(location)}
                  disabled={routeLoading || !location}
                  className="btn-secondary flex-1 !py-2 text-sm"
                >
                  {routeLoading && !live.tracking ? <Spinner size={16} /> : '🧭 Get directions'}
                </motion.button>
                {!live.tracking ? (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={startTracking} className="btn-primary flex-1 !py-2 text-sm">▶ Start live tracking</motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={stopTracking} className="btn-danger flex-1 !py-2 text-sm">■ Stop tracking</motion.button>
                )}
              </div>
              {live.tracking && <p className="text-xs text-brand-600 mt-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow" /> Tracking your live location — route refreshes automatically.</p>}
              {live.error && <p className="text-xs text-red-500 mt-2">{live.error}</p>}
            </div>
          </FadeIn>

          {user?.role === 'user' && (
            <FadeIn delay={0.3}>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowBooking(true)}
                disabled={station.availableSlots === 0}
                className="btn-primary w-full mt-4"
              >
                {station.availableSlots === 0 ? 'No slots available' : 'Book this station'}
              </motion.button>
            </FadeIn>
          )}
        </div>

        <FadeIn delay={0.12}>
          <MapView
            stations={[station]}
            center={mapCenter}
            route={route?.coords}
            liveLocation={live.tracking ? live.position : null}
            heightClass="h-80 md:h-full"
          />
        </FadeIn>
      </div>

      {/* Reviews - read only here. Drivers can only submit a rating from
          the specific booking's page once that charging session has
          completed, so ratings always reflect a real completed visit. */}
      <FadeIn delay={0.1} className="mt-10">
        <h2 className="font-display text-xl font-semibold mb-4">Reviews</h2>

        {station.reviews?.length ? (
          <StaggerList className="space-y-3" staggerDelay={0.08}>
            {station.reviews.map((r) => (
              <StaggerItem key={r.id}>
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="card p-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{r.user?.name || 'EV User'}</span>
                    <StarRating value={r.rating} readOnly size={16} />
                  </div>
                  {r.comment && <p className="text-sm text-slate-500 mt-1">{r.comment}</p>}
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <p className="text-sm text-slate-500">No reviews yet — charge here and rate your experience once your session completes.</p>
        )}
      </FadeIn>

      <AnimatePresence>
        {showBooking && (
          <BookingModal station={station} onClose={() => { setShowBooking(false); params.delete('book'); setParams(params); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
