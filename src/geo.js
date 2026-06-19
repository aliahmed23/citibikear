// Geo math. Equirectangular approximations — fine at <1km (PRD §6.3).
const R = 6371000; // m
const RAD = Math.PI / 180;

export function distanceM(lat1, lng1, lat2, lng2) {
  const x = (lng2 - lng1) * RAD * Math.cos(((lat1 + lat2) / 2) * RAD);
  const y = (lat2 - lat1) * RAD;
  return Math.sqrt(x * x + y * y) * R;
}

// Initial bearing from point 1 to point 2, degrees clockwise from north [0, 360).
export function bearingTo(lat1, lng1, lat2, lng2) {
  const x = (lng2 - lng1) * RAD * Math.cos(((lat1 + lat2) / 2) * RAD);
  const y = (lat2 - lat1) * RAD;
  return (Math.atan2(x, y) / RAD + 360) % 360;
}

// Normalize an angle difference to (-180, 180].
export function normDelta(deg) {
  return ((deg + 540) % 360) - 180;
}

export function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}
