// Every tunable lamp value lives here (CLAUDE.md section 4).
// Units: positions and radii are in "short-edge units" (1.0 = the shorter
// side of the screen). Times are seconds. These objects are mutable on purpose
// so the sandbox tuning panel (npm run lamp) can adjust them live.

export const LAMP = {
  /** Hard cap on blobs (must match MAX_BLOBS in the shader). */
  MAX_BLOBS: 16,
  /** Resting blob count on desktop / mobile. */
  COUNT_DESKTOP: 13,
  COUNT_MOBILE: 10,
  /** Blob radius range, short-edge units. */
  RADIUS_MIN: 0.045,
  RADIUS_MAX: 0.105,

  /** Bottom fraction of the screen where the heater warms blobs. */
  HEATER_BAND: 0.2,
  /** Temperature gained per second inside the heater band (0..1 scale). */
  HEAT_RATE: 0.09,
  /** Top fraction of the screen where blobs cool. */
  COOL_BAND: 0.28,
  /** Temperature lost per second inside the cool band. */
  COOL_RATE: 0.07,

  /** Upward acceleration per unit of (temperature - 0.5). Higher = faster rise. */
  BUOYANCY: 0.06,
  /** Velocity damping per second. Higher = thicker, slower wax. */
  DRAG: 0.6,
  /** Strength of the slow sideways wander (visual only). */
  WANDER: 0.004,
  /** Speed cap during normal drift, units per second. */
  MAX_DRIFT_SPEED: 0.08,
  /** Absolute speed cap (stirring, bursts), units per second. */
  MAX_SPEED: 1.4,

  /** Spring strength pulling blobs into a formation (portal ring, centre). */
  FORMATION_SPRING: 1.6,
  /** Damping while in formation. */
  FORMATION_DAMPING: 2.2,

  /** Film grain amount (0..0.1). Kills gradient banding. */
  GRAIN: 0.035,
  /** Render resolution scale on desktop / mobile. */
  RESOLUTION_SCALE: 1,
  RESOLUTION_SCALE_MOBILE: 0.6,
  /** Lowest resolution scale adaptive quality may drop to. */
  RESOLUTION_SCALE_MIN: 0.5,
  /** Lamp speed multiplier when prefers-reduced-motion is set. */
  REDUCED_MOTION_SPEED: 0.15,

  /** How fast glow and dim ease toward their targets, per second (≈0.6 s to settle). */
  VISUAL_EASE: 1.6,
  /** Slower dim easing for rate limiting, per second (≈3 s to settle): the lamp "dims slowly". */
  SLOW_DIM_EASE: 0.35,
  /** How dark a rate limit makes the lamp (0..1). */
  RATE_LIMIT_DIM: 0.6,
  /** Longest the lamp stays dimmed for a rate limit, seconds, even if Retry-After is longer. */
  RATE_LIMIT_DIM_MAX_SECONDS: 30,
};

export const STIR = {
  /** Pointer influence radius, short-edge units (≈18% of the short edge). */
  RADIUS: 0.18,
  /** Push-away strength. */
  REPEL: 1.1,
  /** How much blobs are dragged along with the pointer. */
  DRAG_ALONG: 0.55,
  /** Tangential curl strength (the swirl in the wake). */
  SWIRL: 0.45,
  /** Temperature gained per second at the pointer centre. */
  HEAT_GAIN: 0.8,
  /** Pointer speed (units/s) above which strokes split blobs. */
  SPLIT_SPEED: 1.8,
  /** Seconds before a blob can split again. */
  SPLIT_COOLDOWN: 0.7,
  /** Seconds for the wax to gather back to centre after the ring closes. */
  RETURN_SECONDS: 2,
  /** While stirring, blobs keep their surface this many radii outside the entropy ring. */
  RING_CLEARANCE: 1.15,
  /** How fast wax inside the ring eases out, per second (≈0.4 s to clear). Higher = snappier. */
  RING_PUSH_RATE: 6,
  /** Width of the soft edge where wax fades out against the ring, short-edge units. Wider = softer. */
  RING_SOFT_EDGE: 0.08,

  /** Entropy meter: target credited bits to close the ring. */
  TARGET_BITS: 256,
  /** Max credited bits per second. */
  MAX_BITS_PER_SECOND: 60,
  /** Max credited bits per second from keyboard / press-and-hold timing. */
  MAX_HOLD_BITS_PER_SECOND: 30,
  /** Samples hashed together per pool update. */
  BATCH: 32,
  /** Samples examined for straight-line / constant-velocity detection. */
  DIRECTION_WINDOW: 8,
  /** Mean absolute direction change (radians) below which motion counts as a straight line. */
  MIN_DIRECTION_CHANGE: 0.015,
  /** Identical consecutive time deltas allowed before samples are rejected. */
  MAX_REPEATED_DT: 2,
};

export const LANDING = {
  /** Cursor heat radius on the landing screen, short-edge units. */
  HEAT_RADIUS: 0.22,
  /** Temperature gained per second near the cursor. */
  HEAT_GAIN: 0.35,
  /** Gentle pull toward the cursor. */
  ATTRACT: 0.03,
};
