
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { plannerApi, bookingApi, vehicleApi, paymentApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';
import ChargeBar from './ChargeBar';
import PaymentModal from './PaymentModal';

function nowLocalDatetime() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function BookingModal({ station, onClose }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState('');
  const [startPercent, setStartPercent] = useState(50);
  const [target, setTarget] = useState(90);
  const [slotStart, setSlotStart] = useState(() => {
    const d = new Date(Date.now() + 30 * 60000 - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  });
  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [pendingPayment, setPendingPayment] = useState(null); // { id, amount, bookingId }
  const navigate = useNavigate();

  useEffect(() => {
    vehicleApi.list().then((res) => {
      setVehicles(res.data.vehicles);
      const def = res.data.vehicles.find((v) => v.isDefault) || res.data.vehicles[0];
      if (def) {
        setVehicleId(String(def.id));
        setStartPercent(def.currentBatteryPercent);
      }
    }).finally(() => setVehiclesLoading(false));
  }, []);

  function onSelectVehicle(id) {
    setVehicleId(id);
    const v = vehicles.find((x) => String(x.id) === id);
    if (v) setStartPercent(v.currentBatteryPercent);
  }

  useEffect(() => {
    if (target <= Number(startPercent)) setTarget(Math.min(100, Number(startPercent) + 10));
  }, [startPercent]); // eslint-disable-line

  // ----- DEBOUNCED PLANNING (300ms) -----
  useEffect(() => {
    if (!vehicleId) return;

    const timer = setTimeout(() => {
      setPlanning(true);
      setError('');

      plannerApi
        .plan({
          vehicleId: Number(vehicleId),
          stationId: station.id,
          targetBatteryPercent: Number(target),
          startBatteryPercent: Number(startPercent),
        })
        .then((res) => setPlan(res.data.plan))
        .catch((err) => {
          setError(err.response?.data?.message || 'Could not compute plan.');
          setPlan(null);
        })
        .finally(() => setPlanning(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [vehicleId, target, startPercent, station.id]);
  // --------------------------------------

  const selectedVehicle = vehicles.find((v) => String(v.id) === vehicleId);
  const isUserAccount = user?.role === 'user';
  const emptyStateMessage = isUserAccount
    ? (
      <>
        You need to add a vehicle to your garage before booking.{' '}
        <a href="/garage" className="text-brand-600 font-medium">Add one now →</a>
      </>
    )
    : (
      <>Booking slots are available for user accounts only. Please sign in with a user account to continue.</>
    );

  async function confirmBooking() {
    setBooking(true);
    setError('');
    try {
      const res = await bookingApi.create({
        stationId: station.id,
        vehicleId: Number(vehicleId),
        slotStart: new Date(slotStart).toISOString(),
        targetBatteryPercent: Number(target),
        startBatteryPercent: Number(startPercent),
      });
      // Slot is reserved but not yet confirmed - the booking stays in
      // 'pending_payment' until the demo gateway settles, so open the
      // payment step immediately instead of navigating away.
      const paymentRes = await paymentApi.create(res.data.booking.id);
      setPendingPayment(paymentRes.data.payment);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed.');
    } finally {
      setBooking(false);
    }
  }

  if (pendingPayment) {
    return createPortal(
      <PaymentModal
        payment={pendingPayment}
        onClose={onClose}
        onSuccess={(data) => navigate(`/bookings/${data.booking.id}`)}
      />,
      document.body
    );
  }

  if (vehiclesLoading) return null;

  return createPortal(
    <div
      className="booking-modal fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="card w-full sm:max-w-lg max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl relative z-10"
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 modal-header z-10">
          <div>
            <h3 className="font-display font-semibold">Book charging slot</h3>
            <p className="text-xs text-slate-500">{station.name}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9, rotate: 90 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ✕
          </motion.button>
        </div>

        <div className="p-5 space-y-4">
          {vehicles.length === 0 ? (
            <div className="text-sm text-slate-500">{emptyStateMessage}</div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium block mb-1.5">Vehicle</label>
                <select value={vehicleId} onChange={(e) => onSelectVehicle(e.target.value)} className="input-field">
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.nickname || `${v.manufacturer} ${v.model}`}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1.5">Slot start time</label>
                <input type="datetime-local" min={nowLocalDatetime()} value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="input-field" />
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1.5">
                  <span>Current battery level (at arrival)</span>
                  <span>{startPercent}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={95}
                  value={startPercent}
                  onChange={(e) => setStartPercent(e.target.value)}
                  className="w-full accent-brand-600"
                />
                <p className="text-xs text-slate-400 mt-1">Tell us the actual charge level when you plan to arrive — it may differ from your garage record.</p>
              </div>

              <div>
                <div className="flex justify-between text-sm font-medium mb-1.5">
                  <span>Target battery level</span>
                  <span>{target}%</span>
                </div>
                <input
                  type="range"
                  min={Number(startPercent) + 5}
                  max={100}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full accent-brand-600"
                />
                <ChargeBar percent={Number(startPercent)} startPercent={Number(startPercent)} targetPercent={Number(target)} showLabel={false} animated={false} height="h-2" />
              </div>

              {/* Estimate box with fixed min-height (holds both content and error) */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 min-h-[150px]">
                <h4 className="text-sm font-semibold mb-2">Charging plan estimate</h4>
                <AnimatePresence mode="wait">
                  {planning ? (
                    <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Spinner size={18} />
                    </motion.div>
                  ) : plan ? (
                    <motion.div
                      key="plan"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-2 gap-3 text-sm"
                    >
                      <div><p className="text-slate-500 text-xs">Energy needed</p><p className="font-semibold">{plan.energyNeededKwh} kWh</p></div>
                      <div><p className="text-slate-500 text-xs">Duration</p><p className="font-semibold">{plan.estimatedDurationMin} min</p></div>
                      <div><p className="text-slate-500 text-xs">Charging power</p><p className="font-semibold">{plan.effectivePowerKw} kW</p></div>
                      <div><p className="text-slate-500 text-xs">Cost</p><p className="font-semibold text-brand-600">₹{plan.estimatedCost}</p></div>
                    </motion.div>
                  ) : (
                    <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-slate-400">
                      Adjust the target above to see an estimate.
                    </motion.p>
                  )}
                </AnimatePresence>
                {/* Error appears inside the same box, below the content */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg px-3 py-1.5"
                  >
                    {error}
                  </motion.div>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmBooking}
                disabled={booking || !plan}
                className="btn-primary w-full"
              >
                {booking ? <Spinner size={18} className="text-white" /> : 'Confirm reservation'}
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
