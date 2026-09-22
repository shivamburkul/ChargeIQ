
import { useState, useRef, useCallback } from 'react';

export default function useLiveTracking() {
  const [position, setPosition] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const watchId = useRef(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Live location is not supported in this browser.');
      return;
    }
    setError('');
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => { setError(err.message || 'Could not access your location.'); setTracking(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
  }, []);

  return { position, tracking, error, start, stop };
}


