
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CHARGER_COLORS = {
  'AC Slow': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'AC Fast': 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  'DC Fast': 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  'DC Ultra-Fast': 'bg-volt-400/20 text-volt-600 dark:text-volt-400',
};

export default function StationCard({ station, explanation, score, selectable, selected, onToggleSelect, compact }) {
  const availabilityPct = station.totalSlots ? Math.round((station.availableSlots / station.totalSlots) * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(5,150,105,0.13)' }}
      className="card min-w-0 overflow-hidden p-3 sm:p-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-display font-semibold text-base truncate min-w-0">{station.name}</h3>
            {score !== undefined && (
              <span className="badge bg-volt-400/20 text-volt-600 dark:text-volt-400">⚡ {score} match</span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{station.address}</p>
        </div>
        {selectable && (
          <label className="shrink-0 flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect(station.id)} className="rounded accent-brand-600" />
            Compare
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3 min-w-0">
        <span className={`badge ${CHARGER_COLORS[station.chargerType] || CHARGER_COLORS['AC Fast']}`}>{station.chargerType}</span>
        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{station.maxPowerKw} kW</span>
        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">₹{station.pricePerKwh}/kWh</span>
        {station.distanceKm !== undefined && (
          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{station.distanceKm} km</span>
        )}
        {station.connectorTypes?.map((c) => (
          <span key={c} className="badge bg-slate-50 text-slate-500 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400">{c}</span>
        ))}
      </div>

      {!compact && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Slot availability</span>
            <span>{station.availableSlots}/{station.totalSlots} free</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${availabilityPct > 40 ? 'bg-brand-500' : availabilityPct > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${availabilityPct}%` }}
            />
          </div>
        </div>
      )}

      {station.ratingCount > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          ★ {station.ratingAvg?.toFixed(1)} ({station.ratingCount} review{station.ratingCount !== 1 ? 's' : ''})
        </div>
      )}

      {explanation && (
        <p className="mt-2 text-xs text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 rounded-lg px-2.5 py-1.5">
          🤖 {explanation}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Link to={`/stations/${station.id}`} className="btn-secondary flex-1 !py-2 text-sm">View details</Link>
        <Link to={`/stations/${station.id}?book=1`} className="btn-primary flex-1 !py-2 text-sm">Book slot</Link>
      </div>
    </motion.div>
  );
}


