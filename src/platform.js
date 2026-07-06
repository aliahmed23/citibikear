// Platform shim (PRD §6.2 gotcha): hides heading-reference differences
// between the glasses runtime, iOS Safari, and other browsers.
//
// - Glasses: e.alpha IS compass heading (0–360, clockwise) per Meta docs.
// - iOS Safari: e.alpha is arbitrary-reference; use e.webkitCompassHeading
//   (clockwise from north).
// - Android/desktop (deviceorientationabsolute): alpha is degrees
//   COUNTERclockwise from north => heading = 360 - alpha.

// ASSUMPTION: glasses runtime UA is detectable; adjust the regex after the
// first on-device probe (PRD §10.1). The mrbd meta tag implies a dedicated UA.
export const isGlasses =
  /\b(MRBD|Meta Wearable|RayBan|Ray-Ban)\b/i.test(navigator.userAgent) ||
  (window.screen.width === 600 && window.screen.height === 600);

export const isTouch = !isGlasses && ('ontouchstart' in window);

export function getHeading(e) {
  if (isGlasses) return e.alpha; // already absolute compass heading
  if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
    return e.webkitCompassHeading; // iOS, clockwise from north
  }
  if (e.absolute && typeof e.alpha === 'number') {
    return 360 - e.alpha; // w3c absolute alpha is counterclockwise
  }
  if (typeof e.alpha === 'number') return 360 - e.alpha; // best effort (desktop dev)
  return null;
}

// Prefer the absolute event stream where available.
export function orientationEventName() {
  return 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute'
    : 'deviceorientation';
}

// Must be called from a user gesture (Enter on the start button).
// Glasses runtime auto-grants; iOS needs the explicit requestPermission flow.
export async function requestSensorPermission() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      return r === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

export function watchLocation(onFix, onError) {
  if (!('geolocation' in navigator)) {
    onError(new Error('geolocation unavailable'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(onFix, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0, // always request a fresh fix; no cached positions
  });
  return () => navigator.geolocation.clearWatch(id);
}
