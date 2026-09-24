
import { useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi, blockchainApi } from '../api/endpoints';
import api from '../api/client';
import { startVisiblePolling } from '../hooks/usePolling';
import Spinner from '../components/Spinner';
import FadeIn from '../components/FadeIn';
import { StaggerList, StaggerItem } from '../components/StaggerList';

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activity, setActivity] = useState({});
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [ledgerStatus, setLedgerStatus] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [printingId, setPrintingId] = useState(null);
  const pollRef = useRef(null);

  async function verifyLedger() {
    setVerifying(true);
    setLedgerStatus(null);
    try {
      const res = await blockchainApi.verify();
      setLedgerStatus(res.data);
    } catch {
      setLedgerStatus({ valid: false, reason: 'Could not reach the ledger service.' });
    } finally {
      setVerifying(false);
    }
  }

  async function loadOverview() {
    const [o, a] = await Promise.all([adminApi.overview(), adminApi.activity()]);
    setOverview(o.data);
    setActivity(a.data.bookingsLast30Days);
  }

  useEffect(() => {
    loadOverview().finally(() => setLoading(false));
    // The overview numbers come from cheap aggregation queries with a
    // server-side TTL cache, but 30s is still plenty fresh for a stats
    // panel and further limits how often it needs to touch Firestore at
    // all, and pauses while this tab isn't the one you're looking at.
    pollRef.current = startVisiblePolling(loadOverview, 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (tab === 'users' && users.length === 0) adminApi.users().then((r) => setUsers(r.data.users));
    if (tab === 'stations' && stations.length === 0) adminApi.stations().then((r) => setStations(r.data.stations));
    if (tab === 'bookings' && bookings.length === 0) adminApi.bookings().then((r) => setBookings(r.data.bookings));
  }, [tab]); // eslint-disable-line

  async function removeUser(id) {
    if (!confirm('Remove this user from the platform?')) return;
    const removed = users.find((u) => u.id === id);
    await adminApi.removeUser(id);
    setUsers((u) => u.filter((x) => x.id !== id));
    if (removed?.role === 'owner') {
      setStations((current) => current.filter((station) => station.ownerId !== id));
    }
  }

  async function toggleStation(id) {
    const res = await adminApi.toggleStation(id);
    setStations((s) => s.map((x) => (x.id === id ? res.data.station : x)));
  }

  async function approveStation(id) {
    const res = await adminApi.approveStation(id);
    setStations((s) => {
      const next = s.map((x) => (x.id === id ? { ...x, ...res.data.station, approvalStatus: 'approved' } : x));
      if (next.filter((station) => station.approvalStatus === 'pending').length === 0) {
        setPendingOnly(false);
      }
      return next;
    });
  }

  async function rejectStation(id) {
    if (!window.confirm('Reject and permanently remove this pending station?')) return;
    await adminApi.rejectStation(id);
    setStations((current) => current.filter((station) => station.id !== id));
    setPendingOnly(false);
  }

  async function printReceipt(bookingId) {
    setPrintingId(bookingId);
    try {
      const res = await api.get(adminApi.bookingInvoiceUrl(bookingId), { responseType: 'blob' });
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

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  const chartData = Object.entries(activity).sort().map(([date, count]) => ({ date: date.slice(5), bookings: count }));
  const pendingCount = stations.filter((s) => s.approvalStatus === 'pending').length;
  // Pending stations first so a newly-submitted station is immediately
  // visible at the top of a list that can otherwise have thousands of
  // rows (imported dataset stations), instead of needing to be hunted for.
  const sortedStations = [...stations].sort((a, b) => {
    const aPending = a.approvalStatus === 'pending' ? 0 : 1;
    const bPending = b.approvalStatus === 'pending' ? 0 : 1;
    return aPending - bPending;
  });
  const visibleStations = pendingOnly ? sortedStations.filter((s) => s.approvalStatus === 'pending') : sortedStations;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold mb-1">Admin Console</h1>
        <p className="text-slate-500 text-sm mb-6">Platform-wide oversight and management.</p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="flex gap-2 mb-6 flex-wrap">
          {['overview', 'users', 'stations', 'bookings'].map((t) => (
            <motion.button
              key={t}
              whileTap={{ scale: 0.93 }}
              onClick={() => setTab(t)}
              className={`badge border capitalize relative ${tab === t ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              {t}
              {t === 'stations' && pendingCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold leading-none"
                >
                  {pendingCount}
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {/* mode="popLayout" instead of "wait" — "wait" left a blank gap
          between tabs while the old section fully exited before the new
          one began entering. */}
      <>
        {tab === 'overview' && overview && (
          <div
            key="overview"
          >
            <StaggerList className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" staggerDelay={0.07}>
              {[
                ['EV Drivers', overview.userCount],
                ['Station Owners', overview.ownerCount],
                ['Stations', overview.stationCount],
                ['Bookings', overview.bookingCount],
                ['Completed', overview.completedBookings],
                ['Reviews', overview.reviewCount],
              ].map(([label, val]) => (
                <StaggerItem key={label}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="card p-4"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-display text-xl font-bold mt-1">{val}</p>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerList>

            <StaggerList className="grid sm:grid-cols-3 gap-4 mb-6" staggerDelay={0.1}>
              <StaggerItem>
                <div className="card p-5 sm:col-span-1">
                  <p className="text-xs text-slate-500 mb-1">Total platform revenue</p>
                  <p className="font-display text-3xl font-bold text-brand-600">₹{overview.totalRevenue.toFixed(0)}</p>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="card p-5">
                  <p className="text-xs text-slate-500 mb-1">Successful demo payments</p>
                  <p className="font-display text-3xl font-bold">{overview.successfulPayments ?? 0}</p>
                </div>
              </StaggerItem>
              <StaggerItem>
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-slate-500">Blockchain ledger blocks</p>
                    <button onClick={verifyLedger} disabled={verifying} className="text-[11px] font-medium text-brand-600 hover:underline shrink-0">
                      {verifying ? 'Verifying…' : 'Verify ledger'}
                    </button>
                  </div>
                  <p className="font-display text-3xl font-bold">{overview.blockchainBlockCount ?? 0}</p>
                  <AnimatePresence>
                    {ledgerStatus && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`text-xs mt-1.5 ${ledgerStatus.valid ? 'text-brand-600' : 'text-red-500'}`}
                      >
                        {ledgerStatus.valid ? '✓ Chain intact — every block verified.' : `⚠ ${ledgerStatus.reason || 'Tampering detected.'}`}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </StaggerItem>
            </StaggerList>

            <FadeIn delay={0.2}>
              <div className="card p-5">
                <h2 className="font-display font-semibold mb-3">Bookings — last 30 days</h2>
                {chartData.length === 0 ? (
                  <p className="text-sm text-slate-500">No booking activity yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="bookings" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </FadeIn>
          </div>
        )}

        {tab === 'users' && (
          <div
            key="users"
            className="card overflow-x-auto"
          >
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="p-3 whitespace-nowrap">Name</th><th className="p-3 whitespace-nowrap">Email</th><th className="p-3 whitespace-nowrap">Role</th><th className="p-3 whitespace-nowrap">Joined</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.28 }}
                    className="border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap">{u.name}</td>
                    <td className="p-3 whitespace-nowrap">{u.email}</td>
                    <td className="p-3 capitalize whitespace-nowrap">{u.role}</td>
                    <td className="p-3 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 whitespace-nowrap">{u.role !== 'admin' && <button onClick={() => removeUser(u.id)} className="text-red-600 text-xs font-medium">Remove</button>}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'stations' && (
          <div
            key="stations"
          >
            {pendingCount > 0 && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  ⚠ <strong>{pendingCount}</strong> station{pendingCount === 1 ? '' : 's'} awaiting your approval — sorted to the top of the table below.
                </p>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setPendingOnly((v) => !v)} className="btn-secondary !py-1.5 !px-3 text-xs">
                  {pendingOnly ? 'Show all stations' : 'Show pending only'}
                </motion.button>
              </div>
            )}
            {pendingCount === 0 && (
              <p className="text-sm text-slate-500 mb-4">✅ No stations are currently awaiting approval.</p>
            )}
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="p-3 whitespace-nowrap">Station</th><th className="p-3 whitespace-nowrap">Submitted by</th><th className="p-3 whitespace-nowrap">City</th><th className="p-3 whitespace-nowrap">Approval</th><th className="p-3 whitespace-nowrap">Active</th><th className="p-3"></th>
                </tr></thead>
                <tbody>
                  {visibleStations.map((s, i) => (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      className={`border-b border-slate-100 dark:border-slate-800/60 last:border-0 ${s.approvalStatus === 'pending' ? 'bg-amber-50/60 dark:bg-amber-950/10' : ''}`}
                    >
                      <td className="p-3 whitespace-nowrap">{s.name}</td>
                      <td className="p-3 whitespace-nowrap"><p>{s.owner?.name || 'Platform'}</p><p className="text-xs text-slate-400">{s.owner?.email || s.sourceLabel}</p></td>
                      <td className="p-3 whitespace-nowrap">{s.city}</td>
                      <td className="p-3 whitespace-nowrap"><span className={`badge ${s.approvalStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'}`}>{s.approvalStatus === 'pending' ? 'Pending approval' : 'Approved'}</span></td>
                      <td className="p-3 whitespace-nowrap">{s.isActive ? '✅ Active' : '⛔ Inactive'}</td>
                      <td className="p-3 flex gap-3 whitespace-nowrap">
                        {s.approvalStatus === 'pending' && (
                          <>
                            <button onClick={() => approveStation(s.id)} className="text-brand-600 text-xs font-semibold">✓ Approve</button>
                            <button onClick={() => rejectStation(s.id)} className="text-red-600 text-xs font-semibold">✕ Reject</button>
                          </>
                        )}
                        <button onClick={() => toggleStation(s.id)} className="text-slate-600 text-xs font-medium">Toggle</button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'bookings' && (
          <div
            key="bookings"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card overflow-x-auto"
          >
            <table className="w-full text-sm min-w-[600px]">
              <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="p-3 whitespace-nowrap">Driver</th><th className="p-3 whitespace-nowrap">Station</th><th className="p-3 whitespace-nowrap">Slot</th><th className="p-3 whitespace-nowrap">Status</th><th className="p-3 whitespace-nowrap">Cost</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025, duration: 0.25 }}
                    className="border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap">{b.user?.name || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{b.station?.name || '—'}</td>
                    <td className="p-3 whitespace-nowrap">{new Date(b.slotStart).toLocaleString()}</td>
                    <td className="p-3 capitalize whitespace-nowrap">{b.status.replace('_', ' ')}</td>
                    <td className="p-3 whitespace-nowrap">₹{b.estimatedCost}</td>
                    <td className="p-3 whitespace-nowrap">
                      {b.status === 'completed' && (
                        <button onClick={() => printReceipt(b.id)} disabled={printingId === b.id} className="text-brand-600 text-xs font-medium whitespace-nowrap">
                          {printingId === b.id ? '...' : '🖨️ Print receipt'}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    </div>
  );
}
