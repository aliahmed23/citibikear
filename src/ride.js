// Ride tracking: start/stop lifecycle and elapsed timer.
import { CONFIG } from './config.js';
import { state } from './state.js';

export function initRide() {
  try {
    const r = JSON.parse(localStorage.getItem(CONFIG.RIDE_LS_KEY));
    if (r && r.startTs) state.ride = r;
  } catch { /* corrupted — start fresh */ }
}

export function startRide() {
  state.ride = { startTs: Date.now() };
  localStorage.setItem(CONFIG.RIDE_LS_KEY, JSON.stringify(state.ride));
}

export function endRide() {
  state.ride = null;
  localStorage.removeItem(CONFIG.RIDE_LS_KEY);
}

export function fmtElapsed(startTs) {
  const total = Math.floor((Date.now() - startTs) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
