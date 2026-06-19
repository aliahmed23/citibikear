// Tunables — PRD §4, §6. Verify FOV + smoothing alpha on device (M1).
export const CONFIG = {
  VIEW_PX: 600,
  H_FOV_DEG: 14.1,        // horizontal FOV, degrees (PRD §4.1)
  FOV_PAD_DEG: 2,         // pins ease in/out slightly beyond the edge
  PIN_FIELD_TOP: 60,      // px, below ribbon
  PIN_FIELD_HEIGHT: 420,

  RADIUS_M: 500,          // station search radius
  RIBBON_GAMMA: 0.6,      // fisheye exponent: <1 expands center, compresses edges
  BEST_MIN_COUNT: 3,      // "best" station = nearest with at least this many
  MAX_STATIONS: 40,       // cap per-frame work

  SMOOTH_ALPHA: 0.2,      // exponential smoothing on raw heading (tune 0.15–0.3)
  INTERP_FACTOR: 0.25,    // per-frame shortest-arc interpolation toward smoothed
  TILT_FADE_BETA: 30,     // fade pins when looking down past this (deg), P1

  TARGET_FPS: 30,         // glasses content refresh
  TEXT_UPDATE_HZ: 2,      // counts/distances/ribbon labels

  STATUS_POLL_MS: 30_000,     // default; feed ttl overrides if longer
  STATUS_POLL_IDLE_MS: 60_000,
  IDLE_AFTER_MS: 120_000,     // no heading/GPS movement for 2 min => idle
  STALE_AFTER_MS: 90_000,     // staleness badge threshold
  INFO_TTL_MS: 24 * 3600_000, // station_information cache

  GPS_BAD_ACCURACY_M: 50,

  // NOTE: the PRD's 2.3 URLs return 403 (verified 2026-06-10). The discovery
  // feed at gbfs.citibikenyc.com/gbfs/gbfs.json points to GBFS 1.1 on
  // gbfs.lyft.com — CORS is `*`, ttl 60s, num_ebikes_available present.
  GBFS_INFO_URL: 'https://gbfs.lyft.com/gbfs/1.1/bkn/en/station_information.json',
  GBFS_STATUS_URL: 'https://gbfs.lyft.com/gbfs/1.1/bkn/en/station_status.json',

  LS_INFO_KEY: 'wp.stationInfo.v1',
  LS_CAL_KEY: 'wp.calibrationOffset',
  RIDE_LS_KEY: 'wp.ride.v1',

  // Citibike pricing as of 2026. Update these if rates change.
  PRICING: {
    single: {
      classic: { base: 4.99, freeMin: 30, perMin: 0.26, label: '$4.99 for 30 min' },
      ebike:   { base: 4.99, freeMin: 0,  perMin: 0.26, label: '$4.99 + $0.26/min' },
    },
    member: {
      classic: { base: 0,    freeMin: 45, perMin: 0.17, label: 'Free · 45 min' },
      ebike:   { base: 0,    freeMin: 0,  perMin: 0.19, label: '$0.19/min' },
    },
  },
};
