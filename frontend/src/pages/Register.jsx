
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BoltMark from '../components/BoltMark';
import HeroIllustration from '../components/HeroIllustration';
import Spinner from '../components/Spinner';
import PasswordInput from '../components/PasswordInput';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const user = await register(form);
      navigate(user.role === 'owner' ? '/owner' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col lg:flex-row items-center lg:items-stretch">
      {/* Left: branding / illustration panel */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-10 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 dark:from-brand-700 dark:via-brand-800 dark:to-slate-950 backdrop-blur-2xl dark:backdrop-blur-none border-r border-white/50 dark:border-transparent text-white">
        <div className="absolute inset-0 opacity-25 dark:opacity-20">
          <HeroIllustration className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <BoltMark className="w-9 h-9" />
          <span className="font-display font-bold text-xl">ChargeIQ</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight mb-3 text-white">Join the fastest-growing charging network.</h2>
          <p className="text-brand-100/80">Whether you drive an EV or own a charging point, ChargeIQ gives you the tools to make it effortless.</p>
        </div>
      </div>

      {/* Right: form panel - Matte Glass Container */}
      <div className="flex flex-col justify-center items-center px-6 py-10 w-full lg:w-1/2 overflow-y-auto">
        <div className="w-full max-w-sm glass-panel p-6">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <BoltMark className="w-11 h-11 mb-2" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-1 text-slate-900 dark:text-slate-100">Create your account</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Join the ChargeIQ charging network</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm bg-red-100/80 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg px-3 py-2">{error}</div>}

            <div>
              <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">I am signing up as</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => update('role', 'user')} className={`rounded-xl py-2.5 text-sm font-medium border transition-colors ${form.role === 'user' ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  🚗 EV Driver
                </button>
                <button type="button" onClick={() => update('role', 'owner')} className={`rounded-xl py-2.5 text-sm font-medium border transition-colors ${form.role === 'owner' ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  🔌 Station Owner
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Full name</label>
              <input required value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field" placeholder="Jane Doe" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Email</label>
              <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} className="input-field" placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Phone (optional)</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} className="input-field" placeholder="98765 43210" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
              <PasswordInput value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="At least 6 characters" required />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size={18} className="text-white" /> : 'Create account'}
            </button>

            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Already have an account? <Link to="/login" className="text-brand-600 font-medium">Log in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
