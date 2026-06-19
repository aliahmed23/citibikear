# Citibike AR Dockfinder

AR application for locating nearby Citibike docks, targeting Meta Display Glasses (Ray-Ban Display / Meta smart glasses with displays).

## Overview

Surfaces real-time Citibike station data — dock availability, bike count, distance, and direction — as AR overlays in the wearer's field of view.

## Platform

- **Primary target:** Meta Display Glasses
- **Dev harness:** iPhone Safari / desktop browser (same codebase, 600×600 frame + debug strip + D-pad)
- **Data source:** Citibike GBFS feed (`https://gbfs.citibikenyc.com/gbfs/gbfs.json` → `gbfs.lyft.com/gbfs/1.1/bkn/...`)

## Running

Zero-build static app — serve the repo root:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Sensors (compass/GPS) require HTTPS off-localhost — deploy to any static host or tunnel for phone testing.

## Controls

| Input | Action |
|---|---|
| ArrowUp / ArrowDown | Cycle mode: all bikes → e-bikes → docks (mode chip is also tappable) |
| ArrowLeft / ArrowRight | Cycle focused station by bearing |
| Enter | Open/close detail card |
| `c` (harness only) | Calibration: nudge heading offset with ◀▶, Enter saves |
| `a` / `d` (harness only) | Rotate simulated heading (laptops have no compass) |
| `v` / CAM button (harness only) | Toggle rear-camera passthrough behind the HUD |

### Simulating a location (laptop testing)

Pass coordinates in the URL to spoof GPS and walk around the map without leaving your desk:

```
http://localhost:8000/?lat=40.7308&lng=-73.9973&heading=90
```

Then rotate with `a`/`d` — pins should sweep across the HUD and ribbon ticks should orbit as you turn.

## Docs

- `waypoint-ar-prd.md` — product spec
- `NOTES.md` — build assumptions and on-device verification checklist

## Status

M0 (phone prototype) built; M1 glasses port pending on-device verification.
