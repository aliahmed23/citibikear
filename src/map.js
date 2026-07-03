import { state } from './state.js';
import { CONFIG } from './config.js';

const MAP_VIEW_RADIUS_M = 400; // tight zoom — slightly less than the 0.3mi pin radius

let map = null;
let stationLayer = null;
let userMarker = null;
let radiusCircle = null;
let zoomSet = false;

function pinColor(count) {
  if (count >= 5) return '#2bff6f';
  if (count >= 1) return '#ffb52b';
  return '#ff4d4d';
}

function makeIcon(count) {
  const color = pinColor(count);
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="background:${color}">${count}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function fitToRadius(lat, lng) {
  const latDelta = MAP_VIEW_RADIUS_M / 111320;
  const lngDelta = MAP_VIEW_RADIUS_M / (111320 * Math.cos(lat * Math.PI / 180));
  map.fitBounds(
    [[lat - latDelta, lng - lngDelta], [lat + latDelta, lng + lngDelta]],
    { animate: false, padding: [0, 0] },
  );
}

export function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([40.7128, -74.006], 15);
  // User dot pane sits above the default marker pane (z-index 600)
  map.createPane('userPane').style.zIndex = 650;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  stationLayer = L.layerGroup().addTo(map);
}

export function showMap() {
  const el = document.getElementById('map');
  el.hidden = false;
  if (!map) initMap();
  map.invalidateSize();
  updateMap();
}

export function hideMap() {
  document.getElementById('map').hidden = true;
}

export function updateMap() {
  if (!map) return;
  if (document.getElementById('map').hidden) return;

  const { lat, lng } = state.gps;
  if (lat === null) return;

  // First fix: fit map to exactly 0.3 mile radius, then just pan on subsequent updates
  if (!zoomSet) {
    fitToRadius(lat, lng);
    zoomSet = true;
  } else {
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }

  // User position star — on userPane so it always renders above station pins
  const starIcon = L.divIcon({
    className: '',
    html: '<div class="map-user-star">★</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    pane: 'userPane',
  });
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon: starIcon, pane: 'userPane' }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
    userMarker.setIcon(starIcon);
  }

  // 0.2 mile radius circle — shows pin coverage area
  if (!radiusCircle) {
    radiusCircle = L.circle([lat, lng], {
      radius: CONFIG.RADIUS_M,
      color: '#2be9ff',
      weight: 1,
      fill: false,
      opacity: 0.4,
    }).addTo(map);
  } else {
    radiusCircle.setLatLng([lat, lng]);
  }

  // Station pins (only stations already filtered to 0.2 miles in state.nearby)
  stationLayer.clearLayers();
  const isBikes = state.modeIndex !== 1;
  for (const w of state.nearby) {
    const n = isBikes ? w.meta.bikes : w.meta.docks;
    L.marker([w.lat, w.lng], { icon: makeIcon(n) }).addTo(stationLayer);
  }
}
