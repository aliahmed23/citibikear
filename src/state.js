// Central mutable state. Sensor/data callbacks write; the rAF loop reads.
import { getCalibrationOffset } from './heading.js';

export const state = {
  mode: 'bike',            // 'bike' | 'ebike' | 'dock'
  calibrating: false,
  calibrationOffset: getCalibrationOffset(),
  detailOpen: false,
  focusedId: null,         // station id with focus (cycled by bearing)

  // Heading
  displayHeading: null,    // rAF-interpolated, calibration applied at read time
  tiltBeta: 0,

  // GPS
  gps: { lat: null, lng: null, accuracy: null, ts: 0 },

  // Data
  waypoints: [],           // full joined Waypoint[] (all stations w/ status)
  nearby: [],              // within radius, sorted by distance, capped; has .distance/.bearing
  lastFetchOk: 0,          // ts of last successful status fetch
  fetchFailing: false,

  // Idle detection (PRD §6.5)
  lastActivity: performance.now(),

  // Active ride: { startTs, bikeType: 'classic'|'ebike', plan: 'single'|'member' } | null
  ride: null,
};

export function markActivity() {
  state.lastActivity = performance.now();
}

export function isIdle(idleAfterMs) {
  return performance.now() - state.lastActivity > idleAfterMs;
}
