
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/endpoints';
import FadeIn from '../components/FadeIn';

export default function Profile() {
  const { user, updateUser, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await authApi.updateProfile(form);
      updateUser(res.data.user);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete your account permanently? Your stations will be removed, but booking and payment history will remain in the admin records.')) return;
    try {
      await deleteAccount();
      navigate('/');
    } catch (err) {
      window.alert(err.response?.data?.message || 'Could not delete your account.');
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <FadeIn>
        <h1 className="font-display text-2xl font-bold mb-1">Profile</h1>
        <p className="text-slate-500 text-sm mb-6">{user.email} · <span className="capitalize">{user.role}</span> account</p>
      </FadeIn>

      <FadeIn delay={0.1}>
        <motion.form
          onSubmit={handleSubmit}
          className="card p-5 space-y-4"
        >
          <div>
            <label className="text-sm font-medium block mb-1.5">Full name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Phone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" />
          </div>
          {saved && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-brand-600"
            >
              Profile updated successfully.
            </motion.p>
          )}
          <motion.button whileTap={{ scale: 0.97 }} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save changes'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={handleDelete} className="btn-danger w-full">
            Delete account permanently
          </motion.button>
        </motion.form>
      </FadeIn>
    </div>
  );
}
