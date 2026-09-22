
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { vehicleApi } from '../api/endpoints';
import Spinner from '../components/Spinner';
import ChargeBar from '../components/ChargeBar';
import FadeIn from '../components/FadeIn';
import { StaggerList, StaggerItem } from '../components/StaggerList';

const CONNECTOR_OPTIONS = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', 'Bharat AC001'];

const EMPTY_FORM = {
  manufacturer: '', model: '', variant: '', batteryCapacityKwh: '', rangeKm: '',
  connectorTypes: ['CCS2'], maxChargingSpeedKw: '', nickname: '',
};

export default function Garage() {
  const [vehicles, setVehicles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [v, c] = await Promise.all([vehicleApi.list(), vehicleApi.catalog()]);
    setVehicles(v.data.vehicles);
    setCatalog(c.data.models);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const manufacturers = [...new Set(catalog.map((m) => m.manufacturer))];
  const modelsForManufacturer = catalog.filter((m) => m.manufacturer === form.manufacturer);

  function applyCatalogModel(modelKey) {
    const match = catalog.find((m) => `${m.model}::${m.variant}` === modelKey);
    if (match) {
      setForm((f) => ({
        ...f,
        model: match.model,
        variant: match.variant,
        batteryCapacityKwh: match.batteryCapacityKwh,
        rangeKm: match.rangeKm,
        connectorTypes: match.connectorTypes,
        maxChargingSpeedKw: match.maxChargingSpeedKw,
      }));
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(v) {
    setEditingId(v.id);
    setForm({
      manufacturer: v.manufacturer, model: v.model, variant: v.variant || '',
      batteryCapacityKwh: v.batteryCapacityKwh, rangeKm: v.rangeKm,
      connectorTypes: v.connectorTypes, maxChargingSpeedKw: v.maxChargingSpeedKw,
      nickname: v.nickname || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        batteryCapacityKwh: Number(form.batteryCapacityKwh),
        rangeKm: Number(form.rangeKm),
        maxChargingSpeedKw: Number(form.maxChargingSpeedKw),
      };
      if (editingId) {
        await vehicleApi.update(editingId, payload);
      } else {
        await vehicleApi.add(payload);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Remove this vehicle from your garage?')) return;
    await vehicleApi.remove(id);
    await load();
  }

  async function makeDefault(id) {
    await vehicleApi.setDefault(id);
    await load();
  }

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <FadeIn className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">My Garage</h1>
          <p className="text-slate-500 text-sm">Manage your EVs to get accurate charging estimates.</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => (showForm ? setShowForm(false) : openAddForm())}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ Add vehicle'}
        </motion.button>
      </FadeIn>

      <AnimatePresence>
        {showForm && (
          <motion.form
            key="vehicle-form"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            onSubmit={handleSubmit}
            className="card p-5 mb-6 space-y-4"
          >
            <h3 className="font-semibold text-sm">{editingId ? 'Edit vehicle' : 'Pick from catalog (auto-fills specs)'}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Manufacturer</label>
                <select value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value, model: '', variant: '' }))} className="input-field mt-1">
                  <option value="">Select manufacturer</option>
                  {manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Model / variant</label>
                <select disabled={!form.manufacturer} onChange={(e) => applyCatalogModel(e.target.value)} className="input-field mt-1">
                  <option value="">Select model</option>
                  {modelsForManufacturer.map((m) => (
                    <option key={`${m.model}::${m.variant}`} value={`${m.model}::${m.variant}`}>{m.model} ({m.variant})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Battery capacity (kWh)</label>
                <input type="number" step="0.1" required value={form.batteryCapacityKwh} onChange={(e) => setForm((f) => ({ ...f, batteryCapacityKwh: e.target.value }))} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Range (km)</label>
                <input type="number" required value={form.rangeKm} onChange={(e) => setForm((f) => ({ ...f, rangeKm: e.target.value }))} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Max charging speed (kW)</label>
                <input type="number" step="0.1" required value={form.maxChargingSpeedKw} onChange={(e) => setForm((f) => ({ ...f, maxChargingSpeedKw: e.target.value }))} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Nickname (optional)</label>
                <input value={form.nickname} onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))} className="input-field mt-1" placeholder="My daily driver" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1.5">Connector type(s)</label>
              <div className="flex flex-wrap gap-1.5">
                {CONNECTOR_OPTIONS.map((c) => (
                  <motion.button
                    type="button"
                    key={c}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setForm((f) => ({ ...f, connectorTypes: f.connectorTypes.includes(c) ? f.connectorTypes.filter((x) => x !== c) : [...f.connectorTypes, c] }))}
                    className={`badge border ${form.connectorTypes.includes(c) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                  >
                    {c}
                  </motion.button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400">Current battery level is set when you book a charging slot, not here — since it changes constantly as you drive.</p>

            {error && <div className="text-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">{error}</div>}

            <motion.button whileTap={{ scale: 0.97 }} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add to garage'}
            </motion.button>
          </motion.form>
        )}
      </AnimatePresence>

      {vehicles.length === 0 ? (
        <FadeIn delay={0.1}>
          <div className="card p-10 text-center text-slate-500">Your garage is empty. Add your first EV to start booking charging slots.</div>
        </FadeIn>
      ) : (
        <StaggerList className="grid sm:grid-cols-2 gap-4" staggerDelay={0.1}>
          {vehicles.map((v) => (
            <StaggerItem key={v.id}>
              <motion.div
                whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(5,150,105,0.10)' }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="card p-5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-semibold">{v.nickname || `${v.manufacturer} ${v.model}`}</h3>
                    <p className="text-xs text-slate-500">{v.manufacturer} {v.model} {v.variant}</p>
                  </div>
                  {v.isDefault && <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Default</span>}
                </div>

                <div className="mt-3">
                  <ChargeBar percent={v.currentBatteryPercent} animated={false} />
                  <p className="text-xs text-slate-400 mt-1">Estimated current level — set your exact level when booking a slot.</p>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">{v.batteryCapacityKwh} kWh</p><p className="text-slate-500">Battery</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">{v.rangeKm} km</p><p className="text-slate-500">Range</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg py-2"><p className="font-semibold">{v.maxChargingSpeedKw} kW</p><p className="text-slate-500">Max charge</p></div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {v.connectorTypes.map((c) => <span key={c} className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{c}</span>)}
                </div>

                <div className="flex gap-2 mt-4">
                  {!v.isDefault && <motion.button whileTap={{ scale: 0.96 }} onClick={() => makeDefault(v.id)} className="btn-secondary flex-1 !py-2 text-sm">Set default</motion.button>}
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => openEditForm(v)} className="btn-secondary flex-1 !py-2 text-sm">Edit</motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => remove(v.id)} className="btn-danger flex-1 !py-2 text-sm">Remove</motion.button>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
