
// Uses the free, public OSRM demo routing server (no API key required).
// Runs entirely from the user's browser, so it needs the user's own
// internet connection - the app's own backend/dataset stays fully offline.
export async function fetchDrivingRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing service unavailable.');
  const data = await res.json();
  if (!data.routes || !data.routes.length) throw new Error('No route found.');

  const route = data.routes[0];
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  const hour = new Date().getHours();
  const trafficFactor = hour >= 7 && hour <= 10 || hour >= 16 && hour <= 20 ? 1.35 : 1.2;
  return {
    coords,
    distanceKm: Number((route.distance / 1000).toFixed(1)),
    durationMin: Math.max(1, Math.ceil((route.duration / 60) * trafficFactor)),
  };
}

