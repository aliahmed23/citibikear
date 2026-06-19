// Heading pipeline (PRD §6.2): unwrap -> exponential smoothing.
// Per-frame shortest-arc interpolation toward `smoothed` happens in the
// render loop via interpToward().
import { CONFIG } from './config.js';
import { normDelta, norm360 } from './geo.js';

export class HeadingFilter {
  constructor() {
    this.smoothed = null;   // deg, geographic north, calibration NOT applied
    this.raw = null;
    this.lastEventTs = 0;
    this._eventTimes = [];  // for event-rate debug readout
  }

  update(rawDeg) {
    if (!Number.isFinite(rawDeg)) return;
    this.raw = norm360(rawDeg);
    const now = performance.now();
    this.lastEventTs = now;
    this._eventTimes.push(now);
    if (this._eventTimes.length > 30) this._eventTimes.shift();

    if (this.smoothed === null) {
      this.smoothed = this.raw;
      return;
    }
    // Unwrap across the 0/360 boundary, then exponential smoothing.
    const delta = normDelta(this.raw - this.smoothed);
    this.smoothed = norm360(this.smoothed + CONFIG.SMOOTH_ALPHA * delta);
  }

  eventRateHz() {
    const t = this._eventTimes;
    if (t.length < 2) return 0;
    const span = t[t.length - 1] - t[0];
    return span > 0 ? ((t.length - 1) * 1000) / span : 0;
  }
}

// Move `current` toward `target` along the shortest arc by `factor`.
export function interpToward(current, target, factor) {
  if (current === null) return target;
  return norm360(current + normDelta(target - current) * factor);
}

export function getCalibrationOffset() {
  const v = parseFloat(localStorage.getItem(CONFIG.LS_CAL_KEY));
  return Number.isFinite(v) ? v : 0;
}

export function setCalibrationOffset(deg) {
  localStorage.setItem(CONFIG.LS_CAL_KEY, String(deg));
}
