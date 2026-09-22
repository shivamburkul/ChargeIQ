
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { stationApi } from '../api/endpoints';
import Spinner from '../components/Spinner';

const ROWS = [
  { key: 'network', label: 'Network' },
  { key: 'chargerType', label: 'Charger type' },
  { key: 'maxPowerKw', label: 'Max power', suffix: ' kW' },
  { key: 'pricePerKwh', label: 'Price', prefix: '₹', suffix: '/kWh' },
  { key: 'totalSlots', label: 'Total slots' },
  { key: 'availableSlots', label: 'Available now' },
  { key: 'ratingAvg', label: 'Rating', suffix: '★' },
];

export default function Compare() {
  const [params] = useSearchParams();
  const ids = (params.get('ids') || '').split(',').filter(Boolean);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length < 2) { setLoading(false); return; }
    stationApi.compare(ids).then((res) => setStations(res.data.stations)).finally(() => setLoading(false));
  }, [params.toString()]); // eslint-disable-line

  if (loading) return <div className="py-24 flex justify-center"><Spinner size={32} /></div>;

  if (ids.length < 2) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Nothing to compare yet</h1>
        <p className="text-slate-500 mb-6">Select two or more stations from search results using the "Compare" checkbox.</p>
        <Link to="/search" className="btn-primary">Go to search</Link>
      </div>
    );
  }

  function bestIndex(row) {
    const values = stations.map((s) => s[row.key]);
    if (row.key === 'pricePerKwh') return values.indexOf(Math.min(...values));
    return values.indexOf(Math.max(...values));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
      <h1 className="font-display text-2xl font-bold mb-1">Compare stations</h1>
      <p className="text-slate-500 mb-6">Best value in each row is highlighted.</p>

      <div className="overflow-x-auto card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left p-4 w-40 text-slate-500 font-medium">Station</th>
              {stations.map((s) => (
                <th key={s.id} className="text-left p-4 min-w-[200px]">
                  <Link to={`/stations/${s.id}`} className="font-display font-semibold hover:text-brand-600">{s.name}</Link>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">{s.address}</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const best = bestIndex(row);
              return (
                <tr key={row.key} className="border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                  <td className="p-4 text-slate-500 font-medium">{row.label}</td>
                  {stations.map((s, idx) => (
                    <td key={s.id} className={`p-4 ${idx === best ? 'font-semibold text-brand-600' : ''}`}>
                      {row.prefix || ''}{typeof s[row.key] === 'number' ? (row.key === 'ratingAvg' ? s[row.key].toFixed(1) : s[row.key]) : s[row.key]}{row.suffix || ''}
                      {idx === best && <span className="ml-1.5">✓</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td className="p-4 text-slate-500 font-medium">Connectors</td>
              {stations.map((s) => (
                <td key={s.id} className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {s.connectorTypes.map((c) => <span key={c} className="badge bg-slate-100 dark:bg-slate-800 text-xs">{c}</span>)}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


