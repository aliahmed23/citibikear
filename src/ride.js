// Ride tracking: start/end lifecycle, cost calculation, localStorage persistence.
import { CONFIG } from './config.js';
import { state } from './state.js';

export function initRide() {
  try {
    const r = JSON.parse(localStorage.getItem(CONFIG.RIDE_LS_KEY));
    if (r && r.startTs && r.bikeType && r.plan) state.ride = r;
  } catch { /* corrupted — start fresh */ }
}

export function startRide(bikeType, plan) {
  state.ride = { startTs: Date.now(), bikeType, plan };
  localStorage.setItem(CONFIG.RIDE_LS_KEY, JSON.stringify(state.ride));
}

export function endRide() {
  state.ride = null;
  localStorage.removeItem(CONFIG.RIDE_LS_KEY);
}

export function calcCost(ride) {
  const elapsedMin = (Date.now() - ride.startTs) / 60000;
  const p = CONFIG.PRICING[ride.plan][ride.bikeType];
  return p.base + Math.max(0, elapsedMin - p.freeMin) * p.perMin;
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
