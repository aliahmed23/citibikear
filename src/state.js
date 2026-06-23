// Central mutable state. Sensor/data callbacks write; the rAF loop reads.
import { getCalibrationOffset } from './heading.js';

export const state = {
  calibrating: false,
  calibrationOffset: getCalibrationOffset(),
  detailOpen: false,
  focusedId: null,

  displayHeading: null,
  tiltBeta: 0,

  gps: { lat: null, lng: null, accuracy: null, ts: 0 },
  gpsHeading: null,   // travel direction from GPS velocity (null when stopped)

  waypoints: [],
  nearby: [],               // within 0.3mi, sorted by distance; has .distance/.bearing
  lastFetchOk: 0,
  fetchFailing: false,

  lastActivity: performance.now(),

  // Active ride: { startTs } | null
  ride: null,

  // Mode: 0=BIKES, 1=DOCKS, 2=START
  modeIndex: 0,
  started: false,
};

export function markActivity() {
  state.lastActivity = performance.now();
}

export function isIdle(idleAfterMs) {
  return performance.now() - state.lastActivity > idleAfterMs;
}
