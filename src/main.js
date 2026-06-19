// App boot: start-button gesture -> permissions -> sensors + GPS + GBFS ->
// HUD loop. Single-screen app (no back navigation, PRD §4.2).
import { CONFIG } from './config.js';
import { state, isIdle } from './state.js';
import { HeadingFilter, getCalibrationOffset } from './heading.js';
import {
  isGlasses, getHeading, orientationEventName,
  requestSensorPermission, watchLocation,
} from './platform.js';
import { loadStationInfo, startPolling } from './citibike.js';
import { initRenderer, startLoop, toast } from './render.js';
import { initInput } from './input.js';
import { initCameraButton } from './camera.js';
import { initRide } from './ride.js';
import { initRideUI } from './ride-ui.js';

const filter = new HeadingFilter();
state.calibrationOffset = getCalibrationOffset();

// Dev-harness sim mode (laptop has no compass; optionally spoof GPS):
//   ?lat=40.738&lng=-73.987[&heading=90]
// `a`/`d` keys rotate the simulated heading. Any real orientation event
// takes over (sim keys still nudge, useful for desk-testing on a phone).
const params = new URLSearchParams(location.search);
const sim = {
  lat: parseFloat(params.get('lat')),
  lng: parseFloat(params.get('lng')),
  heading: parseFloat(params.get('heading')),
};
const simGps = Number.isFinite(sim.lat) && Number.isFinite(sim.lng);
let simHeading = Number.isFinite(sim.heading) ? sim.heading : 0;

function onOrientation(e) {
  const h = getHeading(e);
  if (h !== null) {
    filter.update(h);
    simHeading = h; // keep sim continuous if real events stop
  }
  if (typeof e.beta === 'number') state.tiltBeta = e.beta;
}

function initSimHeading() {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'a' && e.key !== 'd') return;
    simHeading = ((simHeading + (e.key === 'a' ? -3 : 3)) % 360 + 360) % 360;
    filter.update(simHeading);
    state.lastActivity = performance.now();
  });
  // Seed so pins render before the first keypress.
  filter.update(simHeading);
}

async function start() {
  document.getElementById('start-screen').hidden = true;
  document.getElementById('hud').hidden = false;

  const granted = await requestSensorPermission();
  if (!granted) toast('MOTION PERMISSION DENIED');

  window.addEventListener(orientationEventName(), onOrientation);
  if (!isGlasses) initSimHeading();

  if (simGps) {
    state.gps = { lat: sim.lat, lng: sim.lng, accuracy: 5, ts: Date.now() };
    toast(`SIM GPS ${sim.lat.toFixed(4)}, ${sim.lng.toFixed(4)}`);
  } else watchLocation(
    (pos) => {
      const moved = state.gps.lat !== null &&
        (Math.abs(pos.coords.latitude - state.gps.lat) > 0.0002 ||
         Math.abs(pos.coords.longitude - state.gps.lng) > 0.0002);
      if (moved) state.lastActivity = performance.now();
      state.gps = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        ts: Date.now(),
      };
    },
    () => toast('WAITING FOR GPS…'),
  );

  try {
    await loadStationInfo();
  } catch {
    toast('STATION LIST FAILED — RETRYING');
  }

  startPolling({
    onData: (waypoints) => {
      state.waypoints = waypoints;
      state.lastFetchOk = Date.now();
      state.fetchFailing = false;
    },
    onError: () => { state.fetchFailing = true; }, // keep last good data
    isIdle: () => isIdle(CONFIG.IDLE_AFTER_MS),
  });

  startLoop();
}

function boot() {
  // Platform-adaptive layout: glasses keep the fixed 600x600 viewport; the
  // harness goes full-bleed. Class must be set before the renderer measures.
  if (!isGlasses) {
    document.body.classList.add('harness');
    // The width=600 viewport meta is for the glasses runtime only.
    document.querySelector('meta[name="viewport"]')
      .setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');
  }

  initRide();
  initRenderer(filter);
  initRideUI();
  initInput();

  if (!isGlasses) {
    document.getElementById('debug-strip').hidden = false;
    initCameraButton();
  }

  const btn = document.getElementById('start-btn');
  btn.focus();
  btn.addEventListener('click', start, { once: true });
}

boot();
