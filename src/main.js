// App boot: mode selection -> permissions -> sensors + GPS + GBFS -> HUD loop.
import { CONFIG } from './config.js';
import { state, isIdle } from './state.js';
import { HeadingFilter, getCalibrationOffset } from './heading.js';
import {
  isGlasses, getHeading, orientationEventName,
  requestSensorPermission, watchLocation,
} from './platform.js';
import { loadStationInfo, startPolling } from './citibike.js';
import { initRenderer, startLoop, toast, initModeSelector } from './render.js';
import { initInput } from './input.js';
import { initRide, startRide, endRide } from './ride.js';

const filter = new HeadingFilter();
state.calibrationOffset = getCalibrationOffset();

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
    simHeading = h;
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
  filter.update(simHeading);
}

async function startApp() {
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
      const h = pos.coords.heading;
      state.gpsHeading = (typeof h === 'number' && isFinite(h)) ? h : null;
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
    onError: () => { state.fetchFailing = true; },
    isIdle: () => isIdle(CONFIG.IDLE_AFTER_MS),
  });

  startLoop();
}

// Called by input.js when the user activates a mode button.
export async function activateMode(modeIndex) {
  state.modeIndex = modeIndex;

  if (modeIndex === 2) {
    // START: toggle ride timer (works before and after GPS is ready)
    if (state.ride) {
      endRide();
    } else {
      startRide();
    }
  }

  if (!state.started) {
    state.started = true;
    await startApp();
  }
}

function boot() {
  if (!isGlasses) {
    document.getElementById('glasses-only-overlay').hidden = false;
    document.body.classList.add('harness');
    document.querySelector('meta[name="viewport"]')
      .setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');
    document.getElementById('debug-strip').hidden = false;
  }

  initRide();
  initRenderer(filter);
  initModeSelector();
  initInput({ onActivate: activateMode });
}

boot();
