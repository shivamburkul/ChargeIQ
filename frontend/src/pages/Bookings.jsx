
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingApi } from '../api/endpoints';
import Spinner from '../components/Spinner';
import FadeIn from '../components/FadeIn';

const STATUS_STYLES = {
  pending_payment: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
  confirmed: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  in_progress: 'bg-volt-400/20 text-volt-600 dark:text-volt-400',
  completed: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  cancelled: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  rescheduled: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.22 } },
};

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    bookingApi.list().then((res) => setBookings(res.data.bookings)).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold mb-1">My Bookings</h1>
        <p className="text-slate-500 text-sm mb-5">Track upcoming, active and past charging sessions.</p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="flex gap-2 mb-5 flex-wrap">
          {['all', 'pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((f) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              whileTap={{ scale: 0.93 }}
              className={`badge border capitalize ${filter === f ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              {f.replace('_', ' ')}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {filtered.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="card p-10 text-center text-slate-500">No bookings here yet. <Link to="/search" className="text-brand-600 font-medium">Find a station →</Link></div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((b, i) => (
              <motion.div
                key={b.id}
                variants={cardVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                layout
                transition={{ delay: i * 0.05 }}
              >
                <motion.div
                  whileHover={{ x: 4, boxShadow: '0 4px 24px rgba(5,150,105,0.10)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <Link to={`/bookings/${b.id}`} className="card p-4 flex items-center justify-between gap-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{b.station?.name}</p>
                      <p className="text-xs text-slate-500">{b.vehicle?.nickname || b.vehicle?.model} · {new Date(b.slotStart).toLocaleString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`badge capitalize ${STATUS_STYLES[b.status]}`}>{b.status.replace('_', ' ')}</span>
                      <p className="text-sm font-semibold mt-1">₹{b.estimatedCost}</p>
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
