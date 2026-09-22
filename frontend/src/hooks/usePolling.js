
// Wraps setInterval so the polled function is skipped while the browser
// tab is in the background. Several dashboards in this app poll the API
// every few seconds for live updates (active charging session, owner
// bookings, admin stats) - if left open in a background tab all day that
// adds up fast against Firebase's free daily read quota, for no benefit
// since the person isn't even looking at it. Returns the interval id, so
// callers can clearInterval() it exactly like before.
export function startVisiblePolling(fn, intervalMs) {
  return setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      fn();
    }
  }, intervalMs);
}


