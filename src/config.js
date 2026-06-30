// Tunables — verify FOV + smoothing alpha on device.
export const CONFIG = {
  VIEW_PX: 600,
  H_FOV_DEG: 14.1,
  FOV_PAD_DEG: 2,
  PIN_FIELD_TOP: 60,
  PIN_FIELD_HEIGHT: 420,

  RADIUS_M: 643,            // 0.4 miles
  RIBBON_GAMMA: 0.6,
  BEST_MIN_COUNT: 3,        // "best" dock station = nearest with at least this many docks
  MAX_STATIONS: 40,

  SMOOTH_ALPHA: 0.2,
  INTERP_FACTOR: 0.25,
  TILT_FADE_BETA: 30,

  TARGET_FPS: 30,
  TEXT_UPDATE_HZ: 2,

  STATUS_POLL_MS: 30_000,
  STATUS_POLL_IDLE_MS: 60_000,
  IDLE_AFTER_MS: 120_000,
  STALE_AFTER_MS: 90_000,
  INFO_TTL_MS: 24 * 3600_000,

  GPS_BAD_ACCURACY_M: 50,

  GBFS_INFO_URL: 'https://gbfs.lyft.com/gbfs/1.1/bkn/en/station_information.json',
  GBFS_STATUS_URL: 'https://gbfs.lyft.com/gbfs/1.1/bkn/en/station_status.json',

  LS_INFO_KEY: 'wp.stationInfo.v1',
  LS_CAL_KEY: 'wp.calibrationOffset',
  RIDE_LS_KEY: 'wp.ride.v1',
};
