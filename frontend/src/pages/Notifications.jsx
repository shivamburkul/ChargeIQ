
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { notificationApi } from '../api/endpoints';
import Spinner from '../components/Spinner';
import FadeIn from '../components/FadeIn';

const TYPE_ICON = { booking: '🔋', reminder: '⏰', promo: '🎉', system: '⚡', review: '⭐' };

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await notificationApi.list();
    setNotifications(res.data.notifications);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await notificationApi.markAllRead();
    await load();
  }

  async function markRead(id) {
    await notificationApi.markRead(id);
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
  }

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl font-bold">Notifications</h1>
        {notifications.some((n) => !n.isRead) && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={markAllRead}
            className="text-sm text-brand-600 font-medium"
          >
            Mark all read
          </motion.button>
        )}
      </FadeIn>

      {notifications.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="card p-10 text-center text-slate-500">You're all caught up.</div>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                transition={{ duration: 0.35, delay: i * 0.045, ease: [0.25, 0.46, 0.45, 0.94] }}
                layout
              >
                <motion.button
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  onClick={() => markRead(n.id)}
                  className={`card p-4 w-full text-left flex gap-3 ${!n.isRead ? 'border-brand-300 dark:border-brand-700 bg-brand-50/40 dark:bg-brand-900/20' : ''}`}
                >
                  <span className="text-xl shrink-0">{TYPE_ICON[n.type] || '⚡'}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {!n.isRead && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto shrink-0 w-2 h-2 rounded-full bg-brand-500 mt-1"
                    />
                  )}
                </motion.button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
