
import { useState, useEffect } from 'react';

const FALLBACK_LOCATION = { lat: 19.0760, lng: 72.8777 }; // Mumbai, used if geolocation is denied/unavailable

export default function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | granted | denied | fallback

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(FALLBACK_LOCATION);
      setStatus('fallback');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('granted');
      },
      () => {
        setLocation(FALLBACK_LOCATION);
        setStatus('denied');
      },
      // enableHighAccuracy asks the device for GPS/assisted-GPS instead of
      // the much coarser (often several km off) WiFi/IP-based network
      // location, which is what the browser uses by default without this
      // flag. maximumAge: 0 also forces a fresh fix instead of reusing an
      // old cached one that might be from a previous location.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }, []);

  return { location, status, fallback: FALLBACK_LOCATION };
}


