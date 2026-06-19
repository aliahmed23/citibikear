# PRD — Waypoint AR for Meta Ray-Ban Display
**Type:** Personal build doc · **Owner:** Ben Crystal · **Status:** Draft v1 · **Date:** June 10, 2026

---

## 1. One-liner

A heads-up web app for Meta Ray-Ban Display that shows live Citi Bike stations as direction-anchored waypoint pins — look toward a station and its pin appears in your HUD with bikes/docks available and distance.

## 2. Goals

Ordered by priority:

1. **Personal daily-use tool** — genuinely useful for finding a bike/dock while moving through NYC.
2. **Demo content** — visually legible in screen recordings / POV footage for socials and portfolio.
3. **Public release** — clean enough to submit when Meta opens a Web App discovery surface.
4. **Stepping stone** — the heading→screen-position pipeline becomes a reusable engine for future waypoint sources and bigger AR projects.

**Success criteria (v1):**
- Standing on a street corner, rotating in place sweeps pins across the HUD that stay locked to real-world station directions (no visible lag or drift at walking-speed head turns).
- Glanceable answer to "where's the nearest bike?" in under 3 seconds.
- Station data is never staler than ~60s.
- Same codebase runs in iPhone Safari (dev harness) and on the glasses (production) with a single platform shim.

## 3. Non-goals (explored and ruled out)

- **QR unlock on glasses** — camera is not exposed to Web Apps (confirmed: unsupported capability), and Citi Bike's unlock API is private (Lyft ecosystem).
- **Payment on glasses** — no NFC, no secure enclave, no PCI path. If unlock is ever pursued, it's a phone deep-link handoff (`citibike://` or universal link), out of scope for v1.
- **Multi-source waypoints** — v1 is Citi Bike only. Mitigated by the normalized `Waypoint` interface (§6.1) so retrofitting is a data-adapter task, not a refactor.
- **True world-locked AR** — the display is a monocular HUD in the lower-right of the right lens, not a full-lens overlay. Pins are *direction*-anchored (correct bearing → screen X), not depth-anchored objects in space. Design for "smart compass," not "Pokémon Go."

## 4. Platform constraints (resolved from Meta Build docs + hardware reviews)

These were the "outstanding unknowns" — most are now answered.

### 4.1 Display
| Spec | Value | Design consequence |
|---|---|---|
| Resolution | 600×600 px fixed viewport | All layout in a square; `overflow: hidden` on body |
| FOV | 20° **diagonal**, square aspect → **~14.1° horizontal / ~14.1° vertical** | Pins visible only within ±7° of gaze heading; need off-screen affordance (§5.3) |
| Pixel density | 42 ppd | Text is sharp; 16px min body, 20–24px primary per Meta guidance |
| Refresh | 90Hz panel, **30Hz content refresh** | Render loop targets 30fps, not 60; smoothness comes from heading filtering, not frame rate |
| Optics | Additive waveguide, monocular (right eye), 30–5,000 nits auto-brightness | **Pure black = transparent.** Black backgrounds, bright high-contrast pins. Avoid large bright fills (glare) |
| Effective sharpness | Closer to ~400×400 effective (per KGOnTech teardown) | Don't rely on 1px hairlines; use ≥2px strokes |

### 4.2 Input
- Neural Band (sEMG) + temple captouch strip both translate to standard **`ArrowUp/Down/Left/Right` and `Enter` keydown events**. No mouse, no touch, no text input, no continuous cursor.
- Every interactive element must be focusable; **88px minimum tap target**; visible focus ring required.
- "Back" navigation is listed as unsupported — design as a single-screen app with focus states, not a page stack.

### 4.3 Sensors
- Standard `DeviceOrientationEvent` (heading/tilt/roll) and `DeviceMotionEvent` (accel/gyro) on `window`.
- Per Meta docs, `e.alpha` on the glasses is **compass heading 0–360°** — i.e., the runtime delivers *already-fused, absolute* orientation. **The custom Kalman/Madgwick layer from the original concept is likely unnecessary** — replace with a lightweight smoothing filter (§6.2). Keep Madgwick as a fallback only if on-device drift proves bad.
- Permission required, must be triggered by a user gesture (Enter press on a start button). Glasses runtime auto-grants in practice; iOS Safari requires the explicit `requestPermission()` flow.

### 4.4 Location
- Standard `navigator.geolocation`, **proxied from the paired phone's GPS**. Expect 5–50m accuracy and a slow first fix (use `timeout: 15000`, `maximumAge: 5000`, `enableHighAccuracy: true`).
- Use `watchPosition` for continuous updates while moving; `clearWatch` when idle.

### 4.5 Storage & runtime
- `localStorage` / `sessionStorage`, 5MB each. Enough to cache `station_information` (~2,200 stations ≈ 600KB JSON, less after pruning fields).
- Unsupported: camera, microphone, text input, offline mode, notifications.
- Required HTML metadata: `<meta name="mrbd-web-app-capable" content="yes">` + description, viewport meta `width=600, height=600, user-scalable=no`.

### 4.6 Still genuinely unknown (verify on device)
1. **Orientation event rate** on the glasses runtime (iOS Safari delivers ~60Hz; glasses unverified). Mitigation: render loop is decoupled from event rate via rAF + interpolation, so any rate ≥15Hz works.
2. **Is `alpha` truly geographic-north absolute on glasses**, and what's its static accuracy? (Magnetometer near a head/frame can be noisy; NYC steel canyons make it worse.) Mitigation: manual calibration nudge (§5.5).
3. **CORS on the glasses web runtime.** GBFS feeds generally serve `Access-Control-Allow-Origin: *`, but verify `gbfs.citibikenyc.com` from the glasses' origin. Mitigation: 30-line proxy on Vercel/Railway that caches and forwards the two feeds (also lets you prune payload size).
4. **CSP / mixed-content restrictions** in the runtime — assume standard browser behavior, serve everything over HTTPS.

## 5. Functional requirements

### 5.1 Core HUD (the radar view) — P0
- Pins for stations within a configurable radius (default 500m) whose bearing falls inside the ±7° horizontal FOV window.
- Pin screen X = linear map of `(bearing − heading)` across the FOV (§6.3). Pin Y = fixed band (optionally offset by distance: closer = lower/larger).
- Each pin: station glyph + bike count (and dock count in "return mode"). Color encodes availability: bright green ≥5 bikes, amber 1–4, red/dim 0.
- Distance label in meters under the focused pin.

### 5.2 Compass ribbon — P0
Because only ~14° of the world is visible at once, a thin horizontal ribbon (top or bottom edge) shows tick marks for **all** nearby stations across full 360°, with the FOV window highlighted. This is the "where do I turn my head" affordance and doubles as the strongest visual element for demo footage.

### 5.3 Off-screen indicators — P1
Edge chevrons (◀ ▶) when the *nearest* or *selected* station is outside the FOV, with degrees-to-turn. (May be redundant with the ribbon — decide after first on-device test.)

### 5.4 Modes & interaction — P0
- **Bike mode / Dock mode** toggle (ArrowUp/ArrowDown): same pins, swaps the count shown and the color logic. This is the killer real-world feature — docking is the harder half of Citi Bike.
- ArrowLeft/ArrowRight: cycle focus through visible pins (or ribbon ticks) by bearing order.
- Enter on a focused pin: detail card — station name, bikes, e-bikes, docks, distance, last-updated age.
- Single-screen app; detail card is an overlay dismissed by Enter again.

### 5.5 Calibration & trust — P1
- Heading offset nudge: hold focus on a known landmark/station, ArrowLeft/Right in a calibration state to apply a ± offset stored in `localStorage`.
- Staleness indicator: dim pins and show "stale" badge if last successful GBFS fetch > 90s ago.
- GPS accuracy badge when `coords.accuracy > 50m`.

### 5.6 Phone dev harness — P0 (it's the dev plan, but it ships as a mode)
Same app served to iPhone Safari renders a 600×600 frame with a debug strip: raw heading, filtered heading, GPS accuracy, event rate, fetch age. Keyboard arrows simulate Neural Band input on desktop; on-screen D-pad on phone.

## 6. System design

### 6.1 Waypoint interface (the retrofit seam)
Everything downstream of the data layer consumes only:

```ts
interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  label: string;          // "W 4 St & 7 Ave"
  primaryCount: number;   // bikes (bike mode) or docks (dock mode)
  meta: Record<string, any>; // ebikes, capacity, station_id, etc.
}
type WaypointSource = { fetch(): Promise<Waypoint[]>; ttlMs: number };
```

`CitibikeSource` is the only implementation in v1. Subway entrances, coffee shops, friend pins later = new `WaypointSource`, zero engine changes.

### 6.2 Heading pipeline (simplified from original concept)

```
deviceorientation event ──► e.alpha (glasses) / e.webkitCompassHeading (iOS)
        │
        ▼
  unwrap 0/360 boundary ──► exponential smoothing (α ≈ 0.15–0.3, tune on device)
        │                    + slerp-style shortest-arc interpolation in the rAF loop
        ▼
  smoothedHeading (deg, geographic north)  + manual calibration offset
```

**Key cross-platform gotcha:** on iOS Safari, `e.alpha` is *arbitrary-reference*, not compass north — you must read `e.webkitCompassHeading` (and note it's measured clockwise, inverted vs alpha). On the glasses, docs state alpha *is* compass heading. The platform shim hides this behind one `getHeading(e)` function. Also prefer `deviceorientationabsolute` where available.

Tilt gating (P1): use `e.beta` to fade the pin layer out when looking >~30° down (reading phone, looking at the dock itself) — reduces visual noise.

### 6.3 Projection math

```js
const H_FOV = 14.1;                       // degrees, verify on device
let delta = bearing - smoothedHeading;     // normalize to (-180, 180]
delta = ((delta + 540) % 360) - 180;
if (Math.abs(delta) <= H_FOV / 2 + PAD) {
  x = 300 + (delta / (H_FOV / 2)) * 300;  // px in 600-wide viewport
}
```

`bearingTo()` is the standard great-circle initial bearing (atan2 form). At <1km ranges an equirectangular approximation is fine and cheaper — use it.

### 6.4 Render loop
- `requestAnimationFrame` loop, target 30fps (matches content refresh). Sensor events write to state; rAF reads, interpolates heading, repositions pins via CSS `transform: translateX()` (compositor-only, no layout thrash).
- Throttle DOM text updates (counts, distances) to ~2Hz; only transforms run per-frame.

### 6.5 Data layer (GBFS)
- `station_information.json` — static-ish (names, lat/lng, capacity). Fetch on launch, cache in `localStorage` with 24h TTL. Prune to needed fields before caching (5MB budget).
- `station_status.json` — live counts. Poll respecting the feed's own `ttl` field (typically 5–60s); default 30s, back off to 60s when idle (no heading change + no GPS movement for 2 min).
- Join on `station_id` into `Waypoint[]`; filter to radius around current GPS before projecting (sort by distance, cap at ~40 nearest to keep per-frame work trivial).
- Fetch failures: keep last good data, show staleness badge, exponential backoff retry.
- CORS contingency: thin caching proxy (Vercel edge function) — also an optimization, since it can pre-join and pre-prune the two feeds into one small payload.

## 7. UX spec (glasses)

- **Canvas:** 600×600, true-black background (transparent on waveguide), `overflow: hidden`.
- **Palette:** electric green / cyan / amber pins on black; white text; thin (2px+) bright strokes. No large filled panels except the detail card, which uses a dark translucent fill.
- **Type:** system sans, 20–24px pin counts, 16px secondary, all-caps station names truncated to ~18 chars.
- **Layout:** compass ribbon top 60px; pin field middle ~400px; status row bottom 60px (mode, GPS badge, data age).
- **Focus:** focused pin scales ~1.2× with glow ring (matches Meta's focusable pattern, 88px targets).
- **Comfort:** this HUD sits bottom-right of the right eye — keep the default state sparse (ribbon + ≤3 pins). Dense info only on demand (Enter).

## 8. Milestones

**M0 — Phone prototype (1–2 weekends)**
Safari harness: heading filter, projection math, GBFS layer, ribbon + pins, debug strip. Exit criteria: walk a block in Brooklyn, pins track real stations convincingly on the phone held at eye level.

**M1 — Glasses port (1 weekend + on-device tuning)**
Deploy via URL per Meta's Web Apps flow; add `mrbd-web-app-capable` meta; swap input shim to arrow/Enter; verify the four §4.6 unknowns on device; tune smoothing α and FOV constant against reality. Exit criteria: success criteria in §2 met on-device.

**M2 — Polish + demo (ongoing)**
Dock mode, detail card, calibration, staleness UX. Capture POV demo footage (glasses screen-record if available, else through-the-lens rig) — natural crossover content with the Onewheel/Insta360 setup. Decide on store submission once Meta's discovery surface and review process are public.

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Magnetic heading unreliable in NYC (steel, subways) | High | Smoothing + manual calibration offset + ribbon UX degrades gracefully (ribbon is useful even with ±15° error; pin-lock is not) |
| Orientation event rate too low on glasses | Low–Med | rAF interpolation decouples render from event rate |
| CORS blocks GBFS | Med | Proxy fallback, ~1hr of work, also improves payload |
| 14° FOV makes "AR pins" feel underwhelming | Med | Ribbon-first design; pins become the delight moment, not the navigation primitive |
| Developer-preview API churn | Med | Everything is standard web APIs; only the input/permission shim is platform-specific |
| GPS accuracy (5–50m) misorders very close stations | Low | Stations are ~300m+ apart in most of NYC; show accuracy badge when degraded |

## 10. Open questions

1. Orientation event rate + alpha reference frame on glasses (test M1 day one — build a 20-line sensor probe page first).
2. CORS from glasses runtime to `gbfs.citibikenyc.com`.
3. Does the runtime support screen recording for demo capture, or is a through-the-lens rig needed?
4. Battery impact of `watchPosition` + 30s polling over a 20-min ride — may need idle backoff tuning.
5. Meta review/distribution process for Web Apps (currently URL-only; store path TBD).

## 11. References

- Meta Web Apps Build docs: `wearables.developer.meta.com/docs/develop/webapps/build/` (capabilities table, input model, sensor/location APIs — updated Jun 9, 2026)
- Meta Web Apps starter kit + AI coding plugin: `github.com/facebookincubator/meta-wearables-webapp`
- GBFS feeds: `gbfs.citibikenyc.com/gbfs/2.3/station_information.json`, `.../station_status.json`
- Display deep-dive (effective resolution, FOV usage): KGOnTech teardown, Oct 2025
