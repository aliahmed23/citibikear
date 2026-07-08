// HUD renderer.
// rAF loop capped at 30fps. Per-frame: heading interpolation + pin transforms
// + ribbon redraw. Text content updates at ~2Hz.
import { CONFIG } from './config.js';
import { state, markActivity } from './state.js';
import { distanceM, bearingTo, normDelta, norm360 } from './geo.js';
import { interpToward } from './heading.js';
import { fmtElapsed } from './ride.js';
import { showMap, hideMap, updateMap } from './map.js';

const HALF_FOV = CONFIG.H_FOV_DEG / 2;

// Track layout: [START, BIKES/DOCKS, LIST/MAP, START, BIKES/DOCKS, LIST/MAP]
// null = BIKES/DOCKS toggle; 'view' = LIST/MAP toggle; 2 = START
const TRACK_MODES = [2, null, 'view', 2, null, 'view'];
let trackIndex = 1; // starts on BIKES/DOCKS toggle
let snapping = false;

const els = {};
let ribbonCtx = null;
let headingFilter = null;
let viewW = CONFIG.VIEW_PX;
const ribbonTicks = [];

export function measure() {
  const app = document.getElementById('app');
  viewW = app.clientWidth || CONFIG.VIEW_PX;
  els['ribbon'].width = viewW;
}

export function initRenderer(filter) {
  headingFilter = filter;
  for (const id of [
    'hud', 'ribbon',
    'status-stale', 'status-age',
    'calibration-banner', 'cal-offset',
    'detail-card', 'detail-name', 'detail-count', 'detail-label', 'detail-dist',
    'toast',
    'debug-strip', 'dbg-raw', 'dbg-flt', 'dbg-gps', 'dbg-rate', 'dbg-fetch',
    'dock-list', 'dock-list-header', 'dock-list-items',
    'timer-display', 'ride-elapsed', 'ride-cost',
  ]) {
    els[id] = document.getElementById(id);
  }
  ribbonCtx = els['ribbon'].getContext('2d');
  measure();
  window.addEventListener('resize', measure);

  els['detail-card'].addEventListener('click', () => { state.detailOpen = false; });

  els['ribbon'].addEventListener('click', (e) => {
    const rect = els['ribbon'].getBoundingClientRect();
    const x = (e.clientX - rect.left) * (els['ribbon'].width / rect.width);
    let best = null;
    for (const t of ribbonTicks) {
      const dx = Math.abs(t.x - x);
      if (dx <= 22 && (!best || dx < best.dx)) best = { dx, id: t.id };
    }
    if (best) {
      markActivity();
      state.focusedId = best.id;
    }
  });
}

// ---------- mode selector ----------
export function initModeSelector() {
  const track = document.getElementById('mode-track');
  track.style.transition = 'none';
  applyTrackPosition(trackIndex);
  refreshModeLabels();
  requestAnimationFrame(() => {
    track.style.transition = 'transform 0.2s ease';
  });

  // Click handlers on track items
  track.querySelectorAll('.mode-item').forEach((el, i) => {
    el.addEventListener('click', () => {
      if (snapping) return;
      markActivity();
      const delta = i - trackIndex;
      if (delta !== 0) {
        for (let d = 0; d < Math.abs(delta); d++) cycleModeSelector(delta > 0 ? 1 : -1);
      } else if (TRACK_MODES[i] === null) {
        state.modeIndex = state.modeIndex === 0 ? 1 : 0;
        refreshModeLabels();
      } else if (TRACK_MODES[i] === 'view') {
        state.viewMode = state.viewMode === 0 ? 1 : 0;
        refreshModeLabels();
      }
    });
  });
}

const ITEM_H = 60; // matches CSS .mode-item height

function applyTrackPosition(idx) {
  const track = document.getElementById('mode-track');
  track.style.transform = `translateY(${ITEM_H - idx * ITEM_H}px)`;
  updateModeFocused(idx);
  const mode = TRACK_MODES[idx];
  if (mode === 2) state.modeIndex = 2;
  // null = toggle: preserve current BIKES/DOCKS selection
}

function updateModeFocused(idx) {
  document.querySelectorAll('.mode-item').forEach((el, i) => {
    el.classList.toggle('mode-focused', i === idx);
  });
}

export function cycleModeSelector(dir) {
  if (snapping) return;
  const newIdx = trackIndex + dir;
  if (newIdx < 0 || newIdx > 5) return;

  trackIndex = newIdx;
  applyTrackPosition(trackIndex);

  // After animating to an edge duplicate, snap to the mirrored real position
  if (trackIndex === 0 || trackIndex === 5) {
    snapping = true;
    const snapTo = trackIndex === 0 ? 3 : 2;
    setTimeout(() => {
      const track = document.getElementById('mode-track');
      track.style.transition = 'none';
      trackIndex = snapTo;
      applyTrackPosition(trackIndex);
      requestAnimationFrame(() => {
        track.style.transition = 'transform 0.2s ease';
        snapping = false;
      });
    }, 220);
  }
}

export function getFocusedTrackMode() {
  return TRACK_MODES[trackIndex];
}

// ---------- nearby list ----------
export function recomputeNearby() {
  const { lat, lng } = state.gps;
  if (lat === null || !state.waypoints.length) {
    state.nearby = [];
    return;
  }
  const out = [];
  for (const w of state.waypoints) {
    const d = distanceM(lat, lng, w.lat, w.lng);
    if (d > CONFIG.RADIUS_M) continue;
    out.push({ ...w, distance: d, bearing: bearingTo(lat, lng, w.lat, w.lng) });
  }
  out.sort((a, b) => a.distance - b.distance);
  state.nearby = out.slice(0, CONFIG.MAX_STATIONS);

  if (state.nearby.length && !state.nearby.some((w) => w.id === state.focusedId)) {
    state.focusedId = state.nearby[0].id;
  }
}

let lastCycleTs = 0;

export function cycleFocus(dir) {
  if (!state.nearby.length) return;
  const now = performance.now();
  const staleFocus = now - lastCycleTs > 5000;
  lastCycleTs = now;

  if (staleFocus) {
    const heading = effectiveHeading();
    let anchor = null;
    if (heading !== null) {
      anchor = state.nearby.find((w) =>
        Math.abs(normDelta(w.bearing - heading)) <= HALF_FOV + CONFIG.FOV_PAD_DEG);
    }
    anchor = anchor ?? state.nearby[0];
    if (anchor.id !== state.focusedId) {
      state.focusedId = anchor.id;
      return;
    }
  }

  const byBearing = [...state.nearby].sort((a, b) => a.bearing - b.bearing);
  const i = byBearing.findIndex((w) => w.id === state.focusedId);
  const next = byBearing[(i + dir + byBearing.length) % byBearing.length];
  state.focusedId = next.id;
}

export function focusedWaypoint() {
  return state.nearby.find((w) => w.id === state.focusedId) ?? null;
}

// ---------- helpers ----------

// Remembers BIKES/DOCKS selection even while START is focused
let lastBikeDockMode = 0;

function modeCount(w) {
  const m = state.modeIndex === 2 ? lastBikeDockMode : state.modeIndex;
  if (state.modeIndex !== 2) lastBikeDockMode = state.modeIndex;
  return m === 0 ? w.meta.bikes : w.meta.docks;
}

function levelClass(n) {
  if (n >= 5) return 'lv-green';
  if (n >= 1) return 'lv-amber';
  return 'lv-red';
}

function fmtDist(m) {
  const ft = Math.round(m * 3.281);
  return `${Math.round(ft / 10) * 10}ft`;
}

function fmtAge(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

function truncLabel(s) {
  return s.length > 18 ? s.slice(0, 17) + '…' : s;
}

function effectiveHeading() {
  return state.displayHeading === null
    ? null
    : norm360(state.displayHeading + state.calibrationOffset);
}

// Travel-relative direction: uses GPS heading when moving, falls back to compass.
function travelDir(stationBearing) {
  const ref = state.gpsHeading ?? effectiveHeading();
  if (ref === null) return '·';
  const delta = normDelta(stationBearing - ref);
  if (Math.abs(delta) <= 30) return '↑';
  if (delta > 150 || delta < -150) return '↓';
  return delta > 0 ? '→' : '←';
}

// ---------- per-frame ----------

function drawRibbon(heading, stale) {
  const ctx = ribbonCtx;
  const W = viewW, H = 60, MID = 36;
  ctx.clearRect(0, 0, W, H);
  if (heading === null) return;

  const degToX = (delta) => {
    const t = Math.pow(Math.abs(delta) / 180, CONFIG.RIBBON_GAMMA);
    return W / 2 + Math.sign(delta) * (W / 2 - 8) * t;
  };

  ctx.fillStyle = 'rgba(43, 233, 255, 0.18)';
  const x0 = degToX(-HALF_FOV), x1 = degToX(HALF_FOV);
  ctx.fillRect(x0, 8, x1 - x0, MID);
  ctx.strokeStyle = 'rgba(43, 233, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0, 8, x1 - x0, MID);

  ctx.fillStyle = '#9aa0a6';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for (const [deg, name] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
    ctx.fillText(name, degToX(normDelta(deg - heading)), 56);
  }

  ribbonTicks.length = 0;
  for (const w of state.nearby) {
    const d = normDelta(w.bearing - heading);
    const x = degToX(d);
    const n = modeCount(w);
    const closeness = 1 - Math.min(w.distance / CONFIG.RADIUS_M, 1);
    const h = 10 + closeness * 22;
    ctx.strokeStyle = stale ? '#5a5a5a'
      : n >= 5 ? '#2bff6f' : n >= 1 ? '#ffb52b' : '#ff4d4d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, MID + 8 - h);
    ctx.lineTo(x, MID + 8);
    ctx.stroke();
    ribbonTicks.push({ x, id: w.id });

    if (w.id === state.focusedId) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, MID + 10);
      ctx.lineTo(x - 5, MID + 17);
      ctx.lineTo(x + 5, MID + 17);
      ctx.closePath();
      ctx.fill();
    }
  }
}


// ---------- slow (2Hz) updates ----------
function refreshChrome() {
  const now = Date.now();
  const age = state.lastFetchOk ? now - state.lastFetchOk : Infinity;
  const stale = age > CONFIG.STALE_AFTER_MS;

  els['status-stale'].hidden = !stale;
  els['status-age'].textContent = state.lastFetchOk ? `data ${fmtAge(age)}` : 'loading…';

  els['calibration-banner'].hidden = !state.calibrating;
  els['cal-offset'].textContent = (state.calibrationOffset >= 0 ? '+' : '') +
    Math.round(state.calibrationOffset);

  refreshDetailCard();
  refreshDockList();
  refreshTimerDisplay();
  refreshModeLabels();

  if (!els['debug-strip'].hidden) {
    els['dbg-raw'].textContent = headingFilter.raw === null ? '–' : headingFilter.raw.toFixed(1);
    els['dbg-flt'].textContent = state.displayHeading === null ? '–' : effectiveHeading().toFixed(1);
    els['dbg-gps'].textContent = state.gps.accuracy === null ? '–' : `±${Math.round(state.gps.accuracy)}m`;
    els['dbg-rate'].textContent = headingFilter.eventRateHz().toFixed(0);
    els['dbg-fetch'].textContent = state.lastFetchOk ? Math.round(age / 1000) : '–';
  }
  return stale;
}

function refreshDockList() {
  // MAP view
  if (state.viewMode === 1) {
    els['dock-list'].hidden = true;
    showMap();
    updateMap();
    return;
  }

  hideMap();
  const hasGps = state.gps.lat !== null;
  const hasLoaded = state.lastFetchOk > 0;
  els['dock-list'].hidden = !hasGps || !hasLoaded;
  if (!hasGps || !hasLoaded) return;

  const effectiveMode = state.modeIndex === 2 ? lastBikeDockMode : state.modeIndex;
  els['dock-list-header'].textContent = effectiveMode === 0 ? 'BIKES NEARBY' : 'DOCKS NEARBY';

  const container = els['dock-list-items'];
  container.textContent = '';

  if (state.nearby.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'dock-entry no-docks';
    msg.textContent = 'NONE IN RANGE';
    container.appendChild(msg);
    return;
  }

  for (const w of state.nearby.slice(0, 5)) {
    const n = modeCount(w);
    const entry = document.createElement('div');
    entry.className = 'dock-entry';

    const arrowEl = document.createElement('span');
    arrowEl.className = 'de-arrow';
    arrowEl.textContent = travelDir(w.bearing);

    const countEl = document.createElement('span');
    countEl.className = `de-count ${levelClass(n)}`;
    countEl.textContent = n;

    const nameEl = document.createElement('span');
    nameEl.className = 'de-name';
    nameEl.textContent = truncLabel(w.label);

    const distEl = document.createElement('span');
    distEl.className = 'de-dist';
    distEl.textContent = fmtDist(w.distance);

    entry.append(arrowEl, countEl, nameEl, distEl);
    container.appendChild(entry);
  }
}

function refreshTimerDisplay() {
  const riding = !!state.ride;
  const inStartMode = state.modeIndex === 2;
  els['timer-display'].hidden = !(riding || (inStartMode && state.started));
  if (riding) {
    els['ride-elapsed'].textContent = fmtElapsed(state.ride.startTs);
    const mins = Math.floor((Date.now() - state.ride.startTs) / 60000);
    els['ride-cost'].textContent = `$${(mins * 0.295).toFixed(2)}`;
  } else if (inStartMode) {
    els['ride-elapsed'].textContent = '00:00';
    els['ride-cost'].textContent = '';
  }
}

export function refreshModeLabels() {
  const isRiding = !!state.ride;
  const isDocks = state.modeIndex === 1;
  const isMap = state.viewMode === 1;
  document.querySelectorAll('.mode-item').forEach((el, i) => {
    if (TRACK_MODES[i] === 2) {
      el.textContent = isRiding ? 'STOP' : 'START';
      el.classList.toggle('mode-stop', isRiding);
    } else if (TRACK_MODES[i] === null) {
      el.classList.toggle('mode-docks', isDocks);
      const lbl = el.querySelector('.tgl-mode-label');
      if (lbl) lbl.textContent = isDocks ? 'DOCKS' : 'BIKES';
    } else if (TRACK_MODES[i] === 'view') {
      el.classList.toggle('mode-map', isMap);
      const lbl = el.querySelector('.tgl-mode-label');
      if (lbl) lbl.textContent = isMap ? 'MAP' : 'LIST';
    }
  });
}

function refreshDetailCard() {
  els['detail-card'].hidden = !state.detailOpen;
  if (!state.detailOpen) return;
  const w = focusedWaypoint();
  if (!w) { state.detailOpen = false; els['detail-card'].hidden = true; return; }
  const n = modeCount(w);
  const isBikes = state.modeIndex === 0;
  els['detail-name'].textContent = w.label;
  els['detail-count'].textContent = n;
  els['detail-label'].textContent = isBikes ? 'bikes free' : 'docks free';
  els['detail-dist'].textContent = fmtDist(w.distance);
}

let toastTimer = null;
export function toast(msg, ms = 2500) {
  els['toast'].textContent = msg;
  els['toast'].hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els['toast'].hidden = true; }, ms);
}

// ---------- main loop ----------
export function startLoop() {
  const frameInterval = 1000 / CONFIG.TARGET_FPS;
  const textInterval = 1000 / CONFIG.TEXT_UPDATE_HZ;
  let lastFrame = 0;
  let lastText = 0;
  let stale = true;
  let lastHeadingForIdle = null;

  function frame(now) {
    requestAnimationFrame(frame);
    if (now - lastFrame < frameInterval) return;
    lastFrame = now;

    if (headingFilter.smoothed !== null) {
      state.displayHeading = interpToward(
        state.displayHeading, headingFilter.smoothed, CONFIG.INTERP_FACTOR);
    }

    if (now - lastText >= textInterval) {
      lastText = now;
      recomputeNearby();
      stale = refreshChrome();
      if (state.displayHeading !== null) {
        if (lastHeadingForIdle === null ||
            Math.abs(normDelta(state.displayHeading - lastHeadingForIdle)) > 2) {
          state.lastActivity = performance.now();
          lastHeadingForIdle = state.displayHeading;
        }
      }
    }

    const heading = effectiveHeading();
    drawRibbon(heading, stale);
  }
  requestAnimationFrame(frame);
}
