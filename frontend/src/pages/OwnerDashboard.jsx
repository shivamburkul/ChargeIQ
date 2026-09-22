
import { useEffect, useState, useRef } from 'react';
import { stationApi } from '../api/endpoints';
import api from '../api/client';
import { startVisiblePolling } from '../hooks/usePolling';
import Spinner from '../components/Spinner';
import StationFormModal from '../components/StationFormModal';

const STATUS_STYLES = {
  pending_payment: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
  confirmed: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  in_progress: 'bg-volt-400/20 text-volt-600 dark:text-volt-400',
  completed: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  cancelled: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  rescheduled: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export default function OwnerDashboard() {
  const [tab, setTab] = useState('stations');
  const [stations, setStations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const pollRef = useRef(null);

  async function loadStations() {
    const res = await stationApi.myStations();
    setStations(res.data.stations);
    res.data.stations.forEach((s) => {
      stationApi.analytics(s.id).then((a) => setAnalytics((prev) => ({ ...prev, [s.id]: a.data }))).catch(() => {});
    });
    return res.data.stations;
  }

  async function loadBookings() {
    const res = await stationApi.ownerBookings();
    setBookings(res.data.bookings);
  }

  async function loadAll(showLoading = true) {
    if (showLoading) setLoading(true);
    await Promise.all([loadStations(), loadBookings()]);
    if (showLoading) setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // Reflect newly-made bookings / slot changes without requiring a manual
    // refresh - poll both stations (for live slot counts) and bookings.
    // The backend caches stations in memory and short-TTL-caches analytics
    // and bookings server-side, so this interval mainly controls how fresh
    // the screen feels, not how many Firestore reads happen.
    pollRef.current = startVisiblePolling(() => { loadStations(); loadBookings(); }, 20000);
    return () => clearInterval(pollRef.current);
  }, []);

  async function remove(id) {
    if (!confirm('Delete this station listing?')) return;
    await stationApi.remove(id);
    await loadStations();
  }

  const [printingId, setPrintingId] = useState(null);
  async function printReceipt(bookingId) {
    setPrintingId(bookingId);
    try {
      const res = await api.get(`/stations/owner/bookings/${bookingId}/invoice`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const win = window.open(blobUrl, '_blank');
      if (win) setTimeout(() => win.print && win.print(), 600);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
    } catch (err) {
      alert(err.response?.data?.message || 'Receipt not available yet for this booking.');
    } finally {
      setPrintingId(null);
    }
  }

  const totalRevenue = Object.values(analytics).reduce((s, a) => s + (a.totalRevenue || 0), 0);
  const totalBookings = Object.values(analytics).reduce((s, a) => s + (a.totalBookings || 0), 0);
  const totalSlotsFree = stations.reduce((s, st) => s + st.availableSlots, 0);

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Owner Dashboard</h1>
          <p className="text-slate-500 text-sm">Manage your charging stations and track live performance.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">+ Add station</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-5"><p className="text-xs text-slate-500">Your stations</p><p className="font-display text-2xl font-bold mt-1">{stations.length}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-500">Total bookings</p><p className="font-display text-2xl font-bold mt-1">{totalBookings}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-500">Total revenue</p><p className="font-display text-2xl font-bold mt-1 text-brand-600">₹{totalRevenue.toFixed(0)}</p></div>
        <div className="card p-5"><p className="text-xs text-slate-500">Slots free now</p><p className="font-display text-2xl font-bold mt-1">{totalSlotsFree}</p></div>
      </div>

      <div className="flex gap-2 mb-5">
        {['stations', 'bookings'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`badge border capitalize ${tab === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>{t}</button>
        ))}
        <span className="badge bg-slate-100 dark:bg-slate-800 text-slate-500 ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow" /> Live, updates every few seconds
        </span>
      </div>

      {tab === 'stations' && (
        stations.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">You haven't listed any stations yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {stations.map((s) => {
              const a = analytics[s.id];
              return (
                <div key={s.id} className="card p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-display font-semibold">{s.name}</h3>
                      <p className="text-xs text-slate-500">{s.address}, {s.city}</p>
                    </div>
                    <span className={`badge ${s.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : s.isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                      {s.approvalStatus === 'pending' ? 'Pending approval' : s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">{a?.totalBookings ?? '—'}</p><p className="text-slate-500">Bookings</p></div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">₹{a?.totalRevenue?.toFixed(0) ?? '—'}</p><p className="text-slate-500">Revenue</p></div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">{s.availableSlots}/{s.totalSlots}</p><p className="text-slate-500">Slots free</p></div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => { setEditing(s); setShowForm(true); }} className="btn-secondary flex-1 !py-2 text-sm">Edit</button>
                    <button onClick={() => remove(s.id)} className="btn-danger flex-1 !py-2 text-sm">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'bookings' && (
        bookings.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">No bookings at your stations yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="p-3 whitespace-nowrap">Driver</th>
                  <th className="p-3 whitespace-nowrap">Station</th>
                  <th className="p-3 whitespace-nowrap">Vehicle</th>
                  <th className="p-3 whitespace-nowrap">Slot</th>
                  <th className="p-3 whitespace-nowrap">Status</th>
                  <th className="p-3 whitespace-nowrap">Cost</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                    <td className="p-3 whitespace-nowrap">
                      <p className="font-medium">{b.user?.name}</p>
                      <p className="text-xs text-slate-400">{b.user?.email}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">{b.station?.name}</td>
                    <td className="p-3 whitespace-nowrap">{b.vehicle?.nickname || `${b.vehicle?.manufacturer} ${b.vehicle?.model}`}</td>
                    <td className="p-3 whitespace-nowrap">{new Date(b.slotStart).toLocaleString()}</td>
                    <td className="p-3 whitespace-nowrap"><span className={`badge ${STATUS_STYLES[b.status]}`}>{b.status.replace('_', ' ')}</span></td>
                    <td className="p-3 whitespace-nowrap">₹{b.estimatedCost}</td>
                    <td className="p-3 whitespace-nowrap">
                      {b.status === 'completed' && (
                        <button onClick={() => printReceipt(b.id)} disabled={printingId === b.id} className="text-brand-600 text-xs font-medium whitespace-nowrap">
                          {printingId === b.id ? '...' : '🖨️ Print receipt'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {showForm && (
        <StationFormModal
          station={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAll(false); }}
        />
      )}
    </div>
  );
}

