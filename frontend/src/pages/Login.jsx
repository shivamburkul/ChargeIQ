
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import BoltMark from '../components/BoltMark';
import HeroIllustration from '../components/HeroIllustration';
import Spinner from '../components/Spinner';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      const redirect = location.state?.from || (user.role === 'admin' ? '/admin' : user.role === 'owner' ? '/owner' : '/dashboard');
      navigate(redirect);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin(adminUser, adminPass);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col lg:flex-row items-center lg:items-stretch">
      {/* Left: branding / illustration panel */}
      <motion.div
        initial={false}
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-10 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 dark:from-brand-700 dark:via-brand-800 dark:to-slate-950 backdrop-blur-2xl dark:backdrop-blur-none border-r border-white/50 dark:border-transparent text-white"
      >
        <div className="absolute inset-0 opacity-25 dark:opacity-20">
          <HeroIllustration className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <BoltMark className="w-9 h-9" />
          <span className="font-display font-bold text-xl">ChargeIQ</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight mb-3 text-white">Charging made effortless, wherever you drive.</h2>
          <p className="text-brand-100/80">Real-time availability, live directions, and transparent pricing across the network.</p>
        </div>
      </motion.div>

      {/* Right: form panel */}
      <motion.div
        initial={false}
        className="flex flex-col justify-center items-center px-6 py-8 overflow-y-auto w-full lg:w-1/2"
      >
        <div className="w-full max-w-sm glass-panel p-6">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <BoltMark className="w-11 h-11 mb-2" />
          </div>

          <div className="flex bg-slate-200/60 dark:bg-slate-800 rounded-xl p-1 mb-6">
            {['login', 'admin'].map((m) => (
              <motion.button
                key={m}
                whileTap={{ scale: 0.96 }}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors relative ${mode === m ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-400'}`}
              >
                {mode === m && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Driver / Owner' : 'Admin'}</span>
              </motion.button>
            ))}
          </div>

          {/* mode="popLayout" instead of "wait": "wait" held the screen
              fully blank between the old form finishing its exit and the
              new one starting to enter — that blank flash was the
              "flickering" between Driver/Owner and Admin tabs. popLayout
              lets the new form start fading in immediately while the old
              one is pulled out of flow and fades out on top of it. */}
          <>
            {mode === 'login' ? (
              <div>
                <h1 className="font-display text-2xl font-bold mb-1 text-slate-900 dark:text-slate-100">Welcome back</h1>
                <p className="text-sm text-slate-700 dark:text-slate-400 mb-6">Log in to manage your charging sessions</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm bg-red-100/80 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg px-3 py-2">
                      {error}
                    </motion.div>
                  )}
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? <Spinner size={18} className="text-white" /> : 'Log in'}
                  </motion.button>
                  <p className="text-center text-sm text-slate-700 dark:text-slate-400">
                    No account? <Link to="/register" className="text-brand-600 font-medium">Sign up</Link>
                  </p>
                </form>
              </div>
            ) : (
              <div>
                <h1 className="font-display text-2xl font-bold mb-1 text-slate-900 dark:text-slate-100">Admin console</h1>
                <p className="text-sm text-slate-700 dark:text-slate-400 mb-6">Sign in to manage the platform</p>

                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm bg-red-100/80 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg px-3 py-2">
                      {error}
                    </motion.div>
                  )}
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Username</label>
                    <input required value={adminUser} onChange={(e) => setAdminUser(e.target.value)} className="input-field" placeholder="admin" />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
                    <PasswordInput value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="••••••" required />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? <Spinner size={18} className="text-white" /> : 'Enter console'}
                  </motion.button>
                </form>
              </div>
            )}
          </>
        </div>
      </motion.div>
    </div>
  );
}
