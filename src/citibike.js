// GBFS data layer (PRD §6.5). The only WaypointSource in v1.
//
// Waypoint shape (PRD §6.1):
// { id, lat, lng, label, primaryCount, meta: { bikes, ebikes, docks, capacity } }
// primaryCount is resolved at render time from mode; we carry both counts in meta.
import { CONFIG } from './config.js';

let stationInfo = null; // [{ id, lat, lng, label, capacity }]

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export async function loadStationInfo() {
  // localStorage cache, 24h TTL, pruned to needed fields (5MB budget).
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.LS_INFO_KEY));
    if (cached && Date.now() - cached.ts < CONFIG.INFO_TTL_MS && cached.stations?.length) {
      stationInfo = cached.stations;
      return stationInfo;
    }
  } catch { /* fall through to network */ }

  const json = await fetchJson(CONFIG.GBFS_INFO_URL);
  stationInfo = json.data.stations.map((s) => ({
    id: s.station_id,
    lat: s.lat,
    lng: s.lon,
    label: s.name,
    capacity: s.capacity ?? 0,
  }));
  try {
    localStorage.setItem(CONFIG.LS_INFO_KEY, JSON.stringify({ ts: Date.now(), stations: stationInfo }));
  } catch { /* quota — run uncached */ }
  return stationInfo;
}

// Fetch live status and join into Waypoint[]. Returns { waypoints, ttlMs }.
export async function fetchWaypoints() {
  if (!stationInfo) await loadStationInfo();
  const json = await fetchJson(CONFIG.GBFS_STATUS_URL);
  const ttlMs = Math.max((json.ttl ?? 30) * 1000, CONFIG.STATUS_POLL_MS);

  const statusById = new Map();
  for (const s of json.data.stations) {
    if (!s.is_installed) continue;
    statusById.set(s.station_id, s);
  }

  const waypoints = [];
  for (const info of stationInfo) {
    const st = statusById.get(info.id);
    if (!st) continue;
    const ebikes = st.num_ebikes_available
      ?? st.vehicle_types_available?.find((v) => v.vehicle_type_id !== '1')?.count
      ?? 0;
    waypoints.push({
      id: info.id,
      lat: info.lat,
      lng: info.lng,
      label: info.label,
      primaryCount: st.num_bikes_available ?? 0,
      meta: {
        bikes: st.num_bikes_available ?? 0,
        ebikes,
        docks: st.num_docks_available ?? 0,
        capacity: info.capacity,
        renting: !!st.is_renting,
        returning: !!st.is_returning,
      },
    });
  }
  return { waypoints, ttlMs };
}

// Polling driver with idle backoff + exponential retry (keeps last good data).
export function startPolling({ onData, onError, isIdle }) {
  let stopped = false;
  let failures = 0;

  async function tick() {
    if (stopped) return;
    let delay;
    try {
      const { waypoints, ttlMs } = await fetchWaypoints();
      failures = 0;
      onData(waypoints);
      delay = isIdle() ? Math.max(ttlMs, CONFIG.STATUS_POLL_IDLE_MS) : ttlMs;
    } catch (err) {
      failures += 1;
      onError(err);
      // Short first retry (5s) so a cold-start network failure recovers quickly
      delay = failures === 1 ? 5_000 : Math.min(CONFIG.STATUS_POLL_MS * 2 ** (failures - 1), 5 * 60_000);
    }
    setTimeout(tick, delay);
  }

  tick();
  return () => { stopped = true; };
}
