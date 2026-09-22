
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { stationApi } from '../api/endpoints';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const CONNECTOR_OPTIONS = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', 'Bharat AC001'];
const CHARGER_TYPES = ['AC Slow', 'AC Fast', 'DC Fast', 'DC Ultra-Fast'];
const AMENITY_POOL = ['Cafe', 'Restroom', 'WiFi', 'Parking', 'Restaurant', 'Mall', 'ATM', 'Lounge'];

const locationDotIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function CenterTracker({ onMoveEnd }) {
  const map = useMapEvents({
    moveend() {
      const c = map.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

function SizeFixer() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    map.invalidateSize();
    const timeout = setTimeout(() => map.invalidateSize(), 250);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => map.invalidateSize())
      : null;
    resizeObserver?.observe(container);

    const onWindowResize = () => map.invalidateSize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      clearTimeout(timeout);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [map]);

  return null;
}

function MapFlyTo({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom, { animate: true, duration: 0.6 });
  }, [center, map, zoom]);

  return null;
}

async function reverseGeocode(lat, lng) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    throw new Error('Reverse geocoding failed');
  }

  const data = await response.json();
  const addressParts = data.address || {};

  return {
    address: data.display_name || '',
    city: addressParts.city || addressParts.town || addressParts.village || addressParts.suburb || addressParts.county || '',
    state: addressParts.state || addressParts.region || '',
  };
}

function LocationPickerMap({ lat, lng, onPick }) {
  const [layer, setLayer] = useState('street');
  const [geoError, setGeoError] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [focusCenter, setFocusCenter] = useState((lat && lng) ? [Number(lat), Number(lng)] : [22.9734, 78.6569]);
  const [focusZoom, setFocusZoom] = useState((lat && lng) ? 15 : 4);
  const stationLocation = (lat && lng) ? [Number(lat), Number(lng)] : null;

  function useCurrentLocation() {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = [position.coords.latitude, position.coords.longitude];
        setCurrentLocation(nextLocation);
        setFocusCenter(nextLocation);
        // Always zoom in close for "use my location" - this is meant to
        // land the picker right on top of where the user is standing, not
        // zoom back out to a country-wide view.
        setFocusZoom(16);
        onPick(nextLocation[0], nextLocation[1]);
      },
      () => setGeoError('Could not detect your current location. Please allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-56 relative">
        <div className="absolute top-3 right-3 z-[500] card !rounded-xl p-1 flex text-xs shadow-md">
          <button
            type="button"
            onClick={() => setLayer('street')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${layer === 'street' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Street
          </button>
          <button
            type="button"
            onClick={() => setLayer('satellite')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${layer === 'satellite' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Satellite
          </button>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="absolute bottom-3 right-3 z-[500] rounded-full w-11 h-11 flex items-center justify-center bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 text-lg"
          title="Use my current location"
        >
          📍
        </button>

        <MapContainer center={focusCenter} zoom={focusZoom} style={{ height: '100%', width: '100%' }}>
          <SizeFixer />
          <MapFlyTo center={focusCenter} zoom={focusZoom} />
          {layer === 'street' ? (
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={18}
            />
          ) : (
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
              maxNativeZoom={17}
            />
          )}
          <CenterTracker onMoveEnd={onPick} />
          {currentLocation && <Marker position={currentLocation} icon={locationDotIcon} />}
        </MapContainer>

        {/* Fixed center pin, drawn on top of the map instead of as a Leaflet
            marker: the exact station location is always "whatever
            coordinate sits under this pin", i.e. the map's own center. This
            sidesteps any click-to-latlng offset issues entirely - move the
            map underneath the pin instead of trying to click a precise
            pixel. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-[400]" style={{ marginTop: '-24px' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50% 50% 50% 0', background: '#dc2626', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
            <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'white', margin: '7px auto' }} />
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-black/30 z-[399]" />
      </div>

      <div className="rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">
        Drag the map so the pin points exactly at your station's location — the address fills in automatically.
      </div>
      {geoError && <div className="text-[11px] text-amber-600 dark:text-amber-400">{geoError}</div>}
    </div>
  );
}

const EMPTY = {
  name: '', network: '', address: '', city: '', state: '', lat: '', lng: '',
  connectorTypes: ['CCS2'], chargerType: 'DC Fast', maxPowerKw: 50, pricePerKwh: 10,
  totalSlots: 4, availableSlots: 4, amenities: [], isActive: true,
};

export default function StationFormModal({ station, onClose, onSaved }) {
  const [form, setForm] = useState(station ? { ...station, connectorTypes: station.connectorTypes || [], amenities: station.amenities || [] } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }
  function toggleArr(field, val) {
    setForm((f) => ({ ...f, [field]: f[field].includes(val) ? f[field].filter((x) => x !== val) : [...f[field], val] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        lat: Number(form.lat), lng: Number(form.lng),
        maxPowerKw: Number(form.maxPowerKw), pricePerKwh: Number(form.pricePerKwh),
        totalSlots: Number(form.totalSlots), availableSlots: Number(form.availableSlots),
      };
      if (station) await stationApi.update(station.id, payload);
      else await stationApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save station.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePickLocation(lat, lng) {
    const nextLat = Number(lat);
    const nextLng = Number(lng);

    setForm((f) => ({
      ...f,
      lat: nextLat.toFixed(5),
      lng: nextLng.toFixed(5),
    }));

    try {
      const resolved = await reverseGeocode(nextLat, nextLng);
      setForm((f) => ({
        ...f,
        address: resolved.address || f.address,
        city: resolved.city || f.city,
        state: resolved.state || f.state,
      }));
    } catch {
      // Keep coordinates even if reverse lookup fails.
    }
  }

  return createPortal(
    <div className="booking-modal fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
      <form onSubmit={handleSubmit} className="card w-full sm:max-w-lg max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-2xl">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 modal-header z-10">
          <h3 className="font-display font-semibold">{station ? 'Edit station' : 'Add new station'}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="text-sm bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="text-xs text-slate-500">Station name</label>
            <input required value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field mt-1" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Network / brand</label>
            <input value={form.network} onChange={(e) => update('network', e.target.value)} className="input-field mt-1" placeholder="e.g. Independent, Tata Power" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Address</label>
            <input required value={form.address} onChange={(e) => update('address', e.target.value)} className="input-field mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">City</label>
              <input required value={form.city} onChange={(e) => update('city', e.target.value)} className="input-field mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Charger type</label>
              <select value={form.chargerType} onChange={(e) => update('chargerType', e.target.value)} className="input-field mt-1">
                {CHARGER_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Station location</label>
            <LocationPickerMap
              lat={form.lat}
              lng={form.lng}
              onPick={handlePickLocation}
            />
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-xs text-slate-500">Latitude</label>
                <input type="number" step="any" required value={form.lat} onChange={(e) => update('lat', e.target.value)} className="input-field mt-1" placeholder="Click map to set" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Longitude</label>
                <input type="number" step="any" required value={form.lng} onChange={(e) => update('lng', e.target.value)} className="input-field mt-1" placeholder="Click map to set" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Max power (kW)</label>
              <input type="number" required value={form.maxPowerKw} onChange={(e) => update('maxPowerKw', e.target.value)} className="input-field mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Price (₹/kWh)</label>
              <input type="number" step="0.1" required value={form.pricePerKwh} onChange={(e) => update('pricePerKwh', e.target.value)} className="input-field mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Total slots</label>
              <input type="number" min="1" required value={form.totalSlots} onChange={(e) => update('totalSlots', e.target.value)} className="input-field mt-1" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Available now</label>
              <input type="number" min="0" required value={form.availableSlots} onChange={(e) => update('availableSlots', e.target.value)} className="input-field mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Connector types</label>
            <div className="flex flex-wrap gap-1.5">
              {CONNECTOR_OPTIONS.map((c) => (
                <button type="button" key={c} onClick={() => toggleArr('connectorTypes', c)} className={`badge border ${form.connectorTypes.includes(c) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Amenities</label>
            <div className="flex flex-wrap gap-1.5">
              {AMENITY_POOL.map((a) => (
                <button type="button" key={a} onClick={() => toggleArr('amenities', a)} className={`badge border ${form.amenities.includes(a) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>{a}</button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} className="accent-brand-600" />
            Station is active and visible to drivers
          </label>

          <button disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save station'}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
