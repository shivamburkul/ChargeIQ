
import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client';
import { bookingApi, reviewApi } from '../api/endpoints';
import { startVisiblePolling } from '../hooks/usePolling';
import Spinner from '../components/Spinner';
import ChargeBar from '../components/ChargeBar';
import StarRating from '../components/StarRating';
import MapView from '../components/MapView';
import useGeolocation from '../hooks/useGeolocation';
import useLiveTracking from '../hooks/useLiveTracking';
import { fetchDrivingRoute } from '../api/routing';
import PaymentModal from '../components/PaymentModal';

function formatMinutes(mins) {
  if (mins <= 0) return 'Any moment now';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function nowLocalDatetime() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function BookingDetail() {
  const { id } = useParams();
  const { location } = useGeolocation();
  const [booking, setBooking] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newSlot, setNewSlot] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [starting, setStarting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [startingPayment, setStartingPayment] = useState(false);

  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const live = useLiveTracking();
  const rerouteTimer = useRef(null);
  const pollRef = useRef(null);
  const wasInProgress = useRef(false);

  async function load() {
    const res = await bookingApi.get(id);
    setBooking(res.data.booking);
    if (res.data.booking.review) setRatingSubmitted(true);
    setLoading(false);
  }

  async function startPayment() {
    setStartingPayment(true);
    try {
      const res = await paymentApi.create(id);
      setPendingPayment(res.data.payment);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not start payment.');
    } finally {
      setStartingPayment(false);
    }
  }

  async function pollProgress() {
    try {
      const res = await bookingApi.progress(id);
      setProgress(res.data);
      if (res.data.status === 'completed' && wasInProgress.current) {
        setJustCompleted(true);
      }
      if (res.data.status === 'in_progress') wasInProgress.current = true;
      if (['completed', 'cancelled'].includes(res.data.status)) {
        clearInterval(pollRef.current);
        load();
      }
    } catch (e) { /* ignore transient errors */ }
  }

  useEffect(() => {
    load();
    pollProgress();
    pollRef.current = startVisiblePolling(pollProgress, 15000);
    return () => clearInterval(pollRef.current);
  }, [id]); // eslint-disable-line

  async function startCharging() {
    setStarting(true);
    try {
      await bookingApi.start(id);
      await load();
      pollProgress();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not start charging.');
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!confirm('Cancel this booking?')) return;
    await bookingApi.cancel(id, 'Cancelled by user from dashboard');
    await load();
  }

  async function reschedule() {
    if (!newSlot) return;
    try {
      await bookingApi.reschedule(id, new Date(newSlot).toISOString());
      setShowReschedule(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not reschedule.');
    }
  }

  async function downloadInvoice() {
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await api.get(bookingApi.invoiceUrl(booking.id), { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `invoice-booking-${booking.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      setDownloadError('Could not download invoice. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  async function submitRating() {
    if (!ratingValue) return;
    setSubmittingRating(true);
    try {
      await reviewApi.add({ stationId: booking.stationId, bookingId: booking.id, rating: ratingValue, comment: ratingComment });
      setRatingSubmitted(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not submit rating.');
    } finally {
      setSubmittingRating(false);
    }
  }

  async function getDirections(from) {
    if (!booking?.station) return;
    setRouteLoading(true);
    try {
      const r = await fetchDrivingRoute(from, { lat: booking.station.lat, lng: booking.station.lng });
      setRoute(r);
    } catch (err) { /* routing needs internet - fail quietly here */ }
    finally { setRouteLoading(false); }
  }

  useEffect(() => {
    if (!live.tracking || !live.position) return undefined;
    getDirections(live.position);
    rerouteTimer.current = setInterval(() => getDirections(live.position), 20000);
    return () => clearInterval(rerouteTimer.current);
  }, [live.tracking]); // eslint-disable-line

  if (loading || !booking) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  const canManage = booking.status === 'confirmed';
  const canCancel = ['pending_payment', 'confirmed'].includes(booking.status);
  const displayStatus = progress?.status ?? booking.status;
  const batteryNow = progress?.currentBatteryEstimate ?? booking.startBatteryPercent;

  const now = new Date();
  const slotEnd = new Date(booking.slotEnd);
  const minutesRemaining = Math.max(0, (slotEnd - now) / 60000);
  const minutesUntilAutoCancel = displayStatus === 'confirmed'
    ? Math.max(0, 60 - (now - new Date(booking.slotStart)) / 60000)
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <Link to="/bookings" className="text-sm text-slate-500 hover:text-brand-600">← All bookings</Link>

      <AnimatePresence>
        {justCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 card p-6 text-center bg-gradient-to-br from-brand-50 to-volt-400/10 dark:from-brand-900/40 dark:to-volt-400/5 border-brand-300 dark:border-brand-700"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="text-5xl mb-2"
            >
              🔋✅
            </motion.div>
            <h2 className="font-display text-xl font-bold text-brand-700 dark:text-brand-300">Charging complete!</h2>
            <p className="text-sm text-slate-500 mt-1">Your vehicle reached {booking.targetBatteryPercent}%. How was your experience?</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="card p-6 mt-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-xl font-bold">{booking.station?.name}</h1>
            <p className="text-slate-500 text-sm">{booking.station?.address}</p>
          </div>
          <span className={`badge capitalize ${displayStatus === 'pending_payment' ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>{displayStatus.replace('_', ' ')}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
          <div><p className="text-slate-500 text-xs">Vehicle</p><p className="font-medium">{booking.vehicle?.nickname || booking.vehicle?.model}</p></div>
          <div><p className="text-slate-500 text-xs">Slot</p><p className="font-medium">{new Date(booking.slotStart).toLocaleString()}</p></div>
          <div><p className="text-slate-500 text-xs">Battery target</p><p className="font-medium">{booking.startBatteryPercent}% → {booking.targetBatteryPercent}%</p></div>
          <div><p className="text-slate-500 text-xs">Cost</p><p className="font-medium">₹{booking.estimatedCost}</p></div>
        </div>

        {displayStatus === 'pending_payment' && (
          <div className="mt-5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 p-4">
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Payment required to confirm this slot</p>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Your slot is held for a short window while payment completes. If payment isn't finished in time, it will be automatically released.
            </p>
            <button onClick={startPayment} disabled={startingPayment} className="btn-primary w-full">
              {startingPayment ? <Spinner size={18} className="text-white" /> : `💳 Pay ₹${booking.estimatedCost} now`}
            </button>
          </div>
        )}

        {displayStatus === 'confirmed' && (
          <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Arrived and plugged in?</p>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              Charging only begins once you tap Start — arriving late is fine, but if you don't start within{' '}
              <strong>{formatMinutes(minutesUntilAutoCancel)}</strong>, this reservation will auto-cancel and the slot will be released.
            </p>
            <button onClick={startCharging} disabled={starting} className="btn-primary w-full">
              {starting ? <Spinner size={18} className="text-white" /> : '▶ Start charging'}
            </button>
          </div>
        )}

        {(displayStatus === 'in_progress' || displayStatus === 'completed') && (
          <div className="mt-5">
            <p className="text-sm font-medium mb-1.5">Charging status</p>
            <ChargeBar
              percent={displayStatus === 'completed' ? booking.targetBatteryPercent : batteryNow}
              startPercent={booking.startBatteryPercent}
              targetPercent={booking.targetBatteryPercent}
              animated={displayStatus === 'in_progress'}
            />
            {displayStatus === 'in_progress' && (
              <p className="text-xs text-slate-500 mt-2">⏱️ Estimated time to reach {booking.targetBatteryPercent}%: <span className="font-medium text-slate-700 dark:text-slate-300">{formatMinutes(minutesRemaining)}</span></p>
            )}
          </div>
        )}

        {displayStatus === 'completed' && (
          <div>
            <button onClick={downloadInvoice} disabled={downloading} className="btn-primary w-full mt-5">
              {downloading ? <Spinner size={18} className="text-white" /> : '📄 Download invoice (PDF)'}
            </button>
            {downloadError && <p className="text-sm text-red-500 mt-2">{downloadError}</p>}
          </div>
        )}

        {/* Rating - only available here, only after charging has completed */}
        {displayStatus === 'completed' && (
          <div className="mt-5 card p-4 text-center">
            {ratingSubmitted ? (
              <p className="text-sm text-brand-600 font-medium">✓ Thanks for rating your session!</p>
            ) : (
              <>
                <p className="text-sm font-medium mb-2">Rate this charging station</p>
                <div className="flex justify-center mb-3">
                  <StarRating value={ratingValue} onChange={setRatingValue} size={32} />
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  className="input-field text-sm mb-2"
                  rows={2}
                  placeholder="Optional: share how it went..."
                />
                <button onClick={submitRating} disabled={!ratingValue || submittingRating} className="btn-primary w-full !py-2 text-sm">
                  {submittingRating ? 'Submitting...' : 'Submit rating'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Directions / live tracking - available while the booking is still active */}
        {['confirmed', 'in_progress'].includes(displayStatus) && (
          <div className="mt-5 card p-4 !bg-slate-50 dark:!bg-slate-800/40">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Directions to station</h3>
              {route && <span className="text-xs text-slate-500">{route.distanceKm} km · {route.durationMin} min</span>}
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => location && getDirections(location)} disabled={routeLoading || !location} className="btn-secondary flex-1 !py-2 text-sm">
                {routeLoading && !live.tracking ? <Spinner size={16} /> : '🧭 Get directions'}
              </button>
              {!live.tracking ? (
                <button onClick={live.start} className="btn-primary flex-1 !py-2 text-sm">▶ Start live tracking</button>
              ) : (
                <button onClick={() => { live.stop(); clearInterval(rerouteTimer.current); }} className="btn-danger flex-1 !py-2 text-sm">■ Stop tracking</button>
              )}
            </div>
            {booking.station && (
              <MapView
                stations={[booking.station]}
                center={live.tracking && live.position ? [live.position.lat, live.position.lng] : (location ? [location.lat, location.lng] : [booking.station.lat, booking.station.lng])}
                route={route?.coords}
                liveLocation={live.tracking ? live.position : null}
                heightClass="h-64"
              />
            )}
          </div>
        )}

        {canManage && (
          <div className="flex gap-2 mt-5">
            <button onClick={() => { setShowReschedule((s) => !s); setNewSlot(nowLocalDatetime()); }} className="btn-secondary flex-1">Reschedule</button>
            <button onClick={cancel} className="btn-danger flex-1">Cancel booking</button>
          </div>
        )}
        {!canManage && canCancel && (
          <div className="mt-5">
            <button onClick={cancel} className="btn-danger w-full">Cancel booking</button>
          </div>
        )}

        {showReschedule && (
          <div className="mt-3 flex gap-2">
            <input type="datetime-local" min={nowLocalDatetime()} value={newSlot} onChange={(e) => setNewSlot(e.target.value)} className="input-field" />
            <button onClick={reschedule} className="btn-primary shrink-0">Save</button>
          </div>
        )}

        {booking.status === 'cancelled' && booking.cancelReason && (
          <p className="text-sm text-slate-500 mt-4">Reason: {booking.cancelReason}</p>
        )}
      </div>

      {pendingPayment && (
        <PaymentModal
          payment={pendingPayment}
          onClose={() => setPendingPayment(null)}
          onSuccess={async () => { setPendingPayment(null); await load(); pollProgress(); }}
        />
      )}
    </div>
  );
}
