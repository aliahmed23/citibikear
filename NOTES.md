# Build notes & assumptions

Implementation of `waypoint-ar-prd.md` (M0 phone harness, glasses-ready). Assumptions made during the autonomous build, in PRD order:

## Stack
- **Zero-build vanilla ES modules** — no bundler, no framework, no deps. Serve the repo root with any static HTTPS server. Rationale: PRD wants one codebase across iPhone Safari and the glasses runtime with minimal platform churn; everything needed is standard web API.
- Run locally: `python3 -m http.server 8000` (sensors need HTTPS off-localhost — use `npx serve` behind a tunnel, or deploy to Vercel/Netlify for phone testing).

## Data layer
- **The PRD's GBFS 2.3 URLs return 403** (verified 2026-06-10). The discovery feed (`gbfs.citibikenyc.com/gbfs/gbfs.json`) points to GBFS **1.1** at `gbfs.lyft.com/gbfs/1.1/bkn/en/...`. Both feeds serve `Access-Control-Allow-Origin: *` (verified with Origin header), `ttl: 60`, 2,411 stations, and `num_ebikes_available` directly — so **no proxy needed for M0**. Re-verify CORS from the glasses origin at M1 (PRD §4.6.3).
- Status poll floor is 30s but the feed ttl (60s) wins when larger; idle (no heading swing >2° and no GPS move ~20m for 2 min) backs off to ≥60s; failures back off exponentially to 5 min, keeping last good data + STALE badge after 90s.
- `station_information` cached in localStorage, pruned to `{id, lat, lng, label, capacity}`, 24h TTL.

## Platform shim assumptions (verify at M1)
- **Glasses UA detection**: regex `/(MRBD|Meta Wearable|RayBan|Ray-Ban)/i` in `src/platform.js` — a guess; fix after the first on-device probe. Detection only gates dev chrome (debug strip, frame border, D-pad) and the alpha interpretation.
- Heading per platform: glasses → `e.alpha` as-is (per Meta docs); iOS → `e.webkitCompassHeading`; other absolute → `360 − alpha`. `deviceorientationabsolute` preferred where present.
- **Tilt gating (P1)** uses `e.beta` with phone-at-eye-level semantics (≈90° upright); the threshold/sign for head-worn beta is unknown — tune on device. Currently effectively inert on the harness.

## UX / interaction decisions
- **Calibration entry**: PRD §5.5 doesn't define how to *enter* calibration without text input or a back stack. Harness binding: `c` key toggles it (Left/Right nudge ±1°, Enter saves to localStorage). Glasses entry gesture TBD on-device — candidates: long-look at status row, or Enter-hold if keydown repeat exists.
- Off-screen chevrons (§5.3) show degrees-to-turn for the **focused** pin (falls back to nearest), hidden while the detail card is open.
- Ribbon spans ±90° (not full 360°) around gaze for tick legibility at 600px; ticks beyond clamp to the edges. Full-360 felt too dense at 42ppd — revisit on device.
- Pin Y position encodes distance (closer = lower + larger), max 8 pins rendered (pool), nearest-first when the FOV is crowded.
- Default focus = nearest station; Left/Right cycles by bearing order across all nearby stations (ribbon ticks), not just visible pins.
- Mode toggle is Up=BIKE / Down=DOCK (explicit, not a blind toggle), with a toast confirming.

## Harness layout
- Platform-adaptive: glasses get the fixed 600×600 viewport; the harness goes full-bleed (renderer measures `#app` at boot/resize, ribbon canvas + projection width follow). Mode chip relocates next to the CAM button on harness. Camera passthrough (`v`/CAM) is harness-only.

## Sim mode (harness only)
- `?lat=&lng=` URL params spoof GPS (skips `watchPosition`); `?heading=` seeds the simulated heading; `a`/`d` rotate it ±3°. Real orientation events take precedence when present. Disabled on glasses.

## Performance
- rAF loop frame-capped to 30fps; pins move via `transform` only; ribbon is a single `<canvas>` redraw; text/counts/nearby-list recompute at 2Hz.

## Not built (per PRD non-goals / later milestones)
- No proxy (CORS verified open) — add the Vercel edge function only if the glasses origin breaks.
- No Madgwick fallback — smoothing-only per §4.3; revisit if on-device drift is bad.
- No QR/payment/multi-source anything.
