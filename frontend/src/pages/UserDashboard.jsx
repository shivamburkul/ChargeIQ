
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingApi, vehicleApi } from '../api/endpoints';
import { startVisiblePolling } from '../hooks/usePolling';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import ChargeBar from '../components/ChargeBar';
import FadeIn from '../components/FadeIn';
import { StaggerList, StaggerItem } from '../components/StaggerList';

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = Number(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    let start = 0;
    const duration = 900;
    const step = 16;
    const increment = target / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProgress, setActiveProgress] = useState(null);
  const pollRef = useRef(null);

  async function loadAll() {
    const [b, v] = await Promise.all([bookingApi.list(), vehicleApi.list()]);
    setBookings(b.data.bookings);
    setVehicles(v.data.vehicles);
    setLoading(false);
    return b.data.bookings;
  }

  useEffect(() => { loadAll(); }, []);

  // Keep the "active session" card genuinely live instead of only updating
  // when the user navigates away and back - poll the active booking's
  // progress endpoint every few seconds while one exists.
  useEffect(() => {
    const active = bookings.find((b) => ['pending_payment', 'confirmed', 'in_progress'].includes(b.status));
    if (!active) return undefined;

    async function poll() {
      try {
        const res = await bookingApi.progress(active.id);
        setActiveProgress(res.data);
        if (['completed', 'cancelled'].includes(res.data.status)) {
          clearInterval(pollRef.current);
          loadAll();
        }
      } catch (e) { /* ignore transient errors */ }
    }
    poll();
    // Polls a single booking doc, which is cheap - but still no need to
    // hammer it every 4s. 15s keeps the live card feeling responsive
    // without adding up over a long-open tab, and pauses entirely while
    // the tab is in the background.
    pollRef.current = startVisiblePolling(poll, 15000);
    return () => clearInterval(pollRef.current);
  }, [bookings.length]); // eslint-disable-line

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  const active = bookings.find((b) => ['pending_payment', 'confirmed', 'in_progress'].includes(b.status));
  const activeStatus = activeProgress?.status ?? active?.status;
  const completed = bookings.filter((b) => b.status === 'completed');
  const totalSpend = completed.reduce((s, b) => s + b.estimatedCost, 0);
  const totalEnergy = completed.reduce((s, b) => s + (b.invoice?.energyKwh || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold mb-1">Welcome back, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 text-sm mb-6">Here's what's happening with your charging.</p>
      </FadeIn>

      <StaggerList className="grid sm:grid-cols-3 gap-4 mb-6" staggerDelay={0.1}>
        <StaggerItem>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="card p-5">
            <p className="text-xs text-slate-500">Total sessions</p>
            <p className="font-display text-2xl font-bold mt-1"><AnimatedNumber value={bookings.length} /></p>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="card p-5">
            <p className="text-xs text-slate-500">Total spend</p>
            <p className="font-display text-2xl font-bold mt-1 text-brand-600">₹<AnimatedNumber value={Math.round(totalSpend)} /></p>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="card p-5">
            <p className="text-xs text-slate-500">Energy consumed</p>
            <p className="font-display text-2xl font-bold mt-1"><AnimatedNumber value={Math.round(totalEnergy * 10) / 10} /> kWh</p>
          </motion.div>
        </StaggerItem>
      </StaggerList>

      <AnimatePresence>
        {active && (
          <motion.div
            key="active-booking"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`card p-5 mb-6 ${activeStatus === 'pending_payment' ? 'border-purple-300 dark:border-purple-700' : 'border-brand-300 dark:border-brand-700'}`}
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-display font-semibold">{activeStatus === 'pending_payment' ? 'Payment required to confirm your slot' : 'Active / upcoming session'}</h2>
              <span className={`badge capitalize ${activeStatus === 'pending_payment' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-volt-400/20 text-volt-600 dark:text-volt-400'}`}>{activeStatus?.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">{active.station?.name} · {new Date(active.slotStart).toLocaleString()}</p>
            {activeStatus === 'in_progress' && (
              <ChargeBar
                percent={activeProgress?.currentBatteryEstimate ?? active.startBatteryPercent}
                startPercent={active.startBatteryPercent}
                targetPercent={active.targetBatteryPercent}
              />
            )}
            <Link to={`/bookings/${active.id}`} className="btn-primary mt-3 inline-flex text-sm !py-2">
              {activeStatus === 'pending_payment' ? 'Complete payment →' : 'View session →'}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <StaggerList className="grid md:grid-cols-2 gap-6" staggerDelay={0.12}>
        <StaggerItem>
          <div className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-display font-semibold">My vehicles</h2>
              <Link to="/garage" className="text-xs text-brand-600 font-medium">Manage →</Link>
            </div>
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-500">No vehicles added yet.</p>
            ) : (
              <div className="space-y-3">
                {vehicles.slice(0, 3).map((v) => (
                  <div key={v.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{v.nickname || `${v.manufacturer} ${v.model}`}</span>
                      <span className="text-slate-500">{v.currentBatteryPercent}%</span>
                    </div>
                    <ChargeBar percent={v.currentBatteryPercent} showLabel={false} animated={false} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="card p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-display font-semibold">Recent bookings</h2>
              <Link to="/bookings" className="text-xs text-brand-600 font-medium">See all →</Link>
            </div>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">No bookings yet. <Link to="/search" className="text-brand-600">Find a station →</Link></p>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 4).map((b) => (
                  <motion.div key={b.id} whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                    <Link to={`/bookings/${b.id}`} className="flex justify-between text-sm py-1.5 hover:text-brand-600">
                      <span className="truncate">{b.station?.name}</span>
                      <span className="text-slate-400 capitalize shrink-0 ml-2">{b.status.replace('_', ' ')}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </StaggerItem>
      </StaggerList>
    </div>
  );
}
