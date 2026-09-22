
import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Fix default marker icons (Leaflet's default asset paths break under bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._get2xIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const liveIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:20px;height:20px;">
           <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.35;animation:mapPulse 1.6s ease-out infinite;"></div>
           <div style="position:absolute;top:5px;left:5px;width:10px;height:10px;border-radius:50%;background:#3b82f6;border:2px solid white;"></div>
         </div>
         <style>@keyframes mapPulse{0%{transform:scale(0.6);opacity:0.6}100%{transform:scale(2.4);opacity:0}}</style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const stationIcon = (highlighted) => L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:${highlighted ? '#84cc16' : '#059669'};display:flex;align-items:center;justify-content:center;color:white;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2px solid white;">⚡</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function popupHtml(s) {
  // Built as a plain HTML string because markers are added to the cluster
  // group imperatively (outside React's render tree), so JSX/React Router's
  // <Link> can't be used here. A normal anchor tag still works fine for
  // in-app navigation since the SPA's router renders whichever route the
  // browser lands on.
  const div = document.createElement('div');
  div.className = 'text-sm';
  div.innerHTML = `
    <p class="font-semibold">${escapeHtml(s.name)}</p>
    <p class="text-xs text-slate-500">${escapeHtml(s.address || '')}</p>
    <p class="text-xs mt-1">₹${s.pricePerKwh}/kWh · ${s.maxPowerKw}kW · ${s.availableSlots}/${s.totalSlots} free</p>
    <a href="/stations/${s.id}" class="text-brand-600 text-xs font-medium block mt-1">View details →</a>
  `;
  return div;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Renders station markers via leaflet.markercluster instead of individual
 * React <Marker> components. With a nationwide dataset this can mean
 * thousands of stations - mounting that many React-managed DOM markers at
 * once freezes the browser and makes the map unusable when zoomed out.
 * Clustering groups nearby markers into a single "N stations" bubble that
 * splits apart as the user zooms in, and chunkedLoading spreads the initial
 * marker insertion across animation frames so the UI stays responsive.
 */
function ClusteredStationMarkers({ stations, highlightedId, onMarkerClick }) {
  const map = useMap();
  const clusterGroupRef = useRef(null);
  const markerByIdRef = useRef(new Map());

  useEffect(() => {
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 50,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      showCoverageOnHover: false,
    });
    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
      clusterGroupRef.current = null;
      markerByIdRef.current.clear();
    };
  }, [map]);

  // Rebuild markers when the station list itself changes (new search/filter results)
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup) return;

    clusterGroup.clearLayers();
    markerByIdRef.current.clear();

    const markers = stations
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => {
        const marker = L.marker([s.lat, s.lng], { icon: stationIcon(s.id === highlightedId) });
        marker.bindPopup(popupHtml(s));
        marker.on('click', () => onMarkerClick && onMarkerClick(s));
        markerByIdRef.current.set(s.id, marker);
        return marker;
      });

    clusterGroup.addLayers(markers);
  }, [stations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-icon just the previously/newly highlighted marker instead of
  // rebuilding the whole cluster (keeps hover/selection snappy at scale).
  useEffect(() => {
    markerByIdRef.current.forEach((marker, id) => {
      marker.setIcon(stationIcon(id === highlightedId));
    });
  }, [highlightedId]);

  return null;
}

function RecenterButton({ center }) {
  const map = useMap();
  return (
    <button
      onClick={() => map.flyTo(center, Math.max(map.getZoom(), 13))}
      className="absolute bottom-6 right-4 z-[400] bg-white dark:bg-slate-800 shadow-lg rounded-full w-10 h-10 flex items-center justify-center text-lg border border-slate-200 dark:border-slate-700"
      title="Recenter on my location"
    >
      📍
    </button>
  );
}

function TileLoadWatcher({ onLoading }) {
  const map = useMap();
  useEffect(() => {
    const start = () => onLoading(true);
    const end = () => onLoading(false);
    map.on('loading', start);
    map.on('load', end);
    map.on('tileload', end);
    return () => {
      map.off('loading', start);
      map.off('load', end);
      map.off('tileload', end);
    };
  }, [map]); // eslint-disable-line
  return null;
}

// Leaflet measures its container's pixel size once on mount. If that
// container is 0x0 or the wrong size at that exact moment - which happens
// constantly here because pages render inside CSS grids/flex layouts,
// behind Framer Motion fade-ins, or before async data finishes loading -
// the map silently renders "broken": no tiles, no markers, but the DOM
// element is still there and still receives mouse events (which is exactly
// the "cursor changes but nothing is visible" symptom). Calling
// invalidateSize() after mount, on any container resize, and once more
// after a short delay (to catch late animation/layout settling) fixes it.
function SizeFixer() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 250);
    const t2 = setTimeout(() => map.invalidateSize(), 800);

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    const onWindowResize = () => map.invalidateSize();
    window.addEventListener('resize', onWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [map]);
  return null;
}

const MAX_ZOOM = 18;
const MIN_ZOOM = 4;

export default function MapView({
  stations = [], center, highlightedId, onMarkerClick, heightClass = 'h-[420px]',
  route = null, liveLocation = null, showLayerToggle = true, defaultLayer = 'satellite',
}) {
  const [layer, setLayer] = useState(defaultLayer);
  const mapCenter = useMemo(() => center || [22.9734, 78.6569], [center]); // default: geographic center of India

  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800`}>
      {showLayerToggle && (
        <div className="absolute top-3 right-3 z-[500] card !rounded-xl p-1 flex text-xs shadow-md">
          <button
            onClick={() => setLayer('street')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${layer === 'street' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Street
          </button>
          <button
            onClick={() => setLayer('satellite')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${layer === 'satellite' ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            Satellite
          </button>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={center ? 12 : 5}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <SizeFixer />
        {layer === 'street' ? (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={MAX_ZOOM}
          />
        ) : (
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={MAX_ZOOM}
            maxNativeZoom={17}
          />
        )}

        {center && !liveLocation && <Marker position={center} icon={userIcon}><Popup>You are here</Popup></Marker>}
        {liveLocation && <Marker position={[liveLocation.lat, liveLocation.lng]} icon={liveIcon}><Popup>Your live location</Popup></Marker>}

        {route && route.length > 1 && (
          <Polyline positions={route} pathOptions={{ color: '#059669', weight: 5, opacity: 0.85 }} />
        )}

        <ClusteredStationMarkers stations={stations} highlightedId={highlightedId} onMarkerClick={onMarkerClick} />

        {center && <RecenterButton center={mapCenter} />}
      </MapContainer>
    </div>
  );
}


