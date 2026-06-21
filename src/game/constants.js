// ─── Canvas ───────────────────────────────────────────────────────────────────
// Logical game resolution, 9:16 portrait. CSS scales to fit the container.
export const GAME_WIDTH = 390
export const GAME_HEIGHT = 844

// Y position of the floor surface (top of the ground strip)
export const FLOOR_Y = GAME_HEIGHT - 120

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_X = 80          // fixed horizontal position (runner auto-scrolls world)
export const PLAYER_WIDTH = 34
export const PLAYER_HEIGHT = 50

// ─── Physics ──────────────────────────────────────────────────────────────────
export const GRAVITY = 2400         // px/s² downward acceleration
export const JUMP_VELOCITY = -820   // negative = upward; first jump
export const DOUBLE_JUMP_VELOCITY = -650

// ─── Slide ────────────────────────────────────────────────────────────────────
// Hitbox shrinks to half height while sliding; obstacle bottom must clear this
export const SLIDE_DURATION = 0.8   // seconds player stays in slide pose

// ─── Dash ─────────────────────────────────────────────────────────────────────
export const DASH_VELOCITY = 900    // px/s forward burst
export const DASH_DURATION = 0.16   // seconds of burst (kept short; snap-back follows)
export const DASH_COOLDOWN = 1.4    // seconds before dash can be used again

// ─── Scroll speed ─────────────────────────────────────────────────────────────
export const BASE_SPEED = 260       // px/s at game start
export const SPEED_RAMP = 10        // extra px/s per 10m — world accelerates over time

// ─── Near-miss combo ──────────────────────────────────────────────────────────
export const NEAR_MISS_DISTANCE = 22  // px gap between player right edge and obstacle left edge
export const COMBO_DECAY_TIME = 5.0   // seconds without a near-miss before combo resets

// ─── Obstacle spawning ────────────────────────────────────────────────────────
export const SPAWN_INTERVAL_MIN = 1.1  // seconds between spawns (minimum, shrinks with distance)
export const SPAWN_INTERVAL_MAX = 2.2

// ─── Kasta distance thresholds (meters) ──────────────────────────────────────
export const KASTA_AC_THRESHOLD = 300       // Kipas Angin → AC Standar
export const KASTA_SINGGAH_THRESHOLD = 700  // AC Standar → Singgahsini
export const KASTA_IMPIAN_THRESHOLD = 1000  // Singgahsini → Mode Kos Impian (endless)
