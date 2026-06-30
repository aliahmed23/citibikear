import { state } from './state.js';

let map = null;
let stationLayer = null;
let userMarker = null;

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

export function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([40.7128, -74.006], 15);
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

  map.setView([lat, lng], 15);

  if (!userMarker) {
    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#2be9ff',
      color: '#000',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }

  stationLayer.clearLayers();
  for (const w of state.nearby) {
    const n = state.modeIndex === 0 ? w.meta.bikes : w.meta.docks;
    L.marker([w.lat, w.lng], { icon: makeIcon(n) }).addTo(stationLayer);
  }
}
