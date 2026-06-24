// ─── Canvas ───────────────────────────────────────────────────────────────────
// Logical game resolution, 9:16 portrait. CSS scales to fit the container.
export const GAME_WIDTH = 390
export const GAME_HEIGHT = 844

// Height of the ground strip at the bottom (design px). The play area lives
// above it; the on-screen control cluster lives below the floor line, in this
// strip, so buttons never overlap obstacles. Sized to clear the cluster box.
export const FLOOR_HEIGHT = 220

// Y position of the floor surface (top of the ground strip)
export const FLOOR_Y = GAME_HEIGHT - FLOOR_HEIGHT

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_X = 80 // fixed horizontal position (runner auto-scrolls world)
export const PLAYER_WIDTH = 52
export const PLAYER_HEIGHT = 76

// ─── Physics ──────────────────────────────────────────────────────────────────
export const GRAVITY = 2400 // px/s² downward acceleration
export const JUMP_VELOCITY = -820 // negative = upward; first jump
export const DOUBLE_JUMP_VELOCITY = -650

// ─── Slide ────────────────────────────────────────────────────────────────────
// Hitbox shrinks to half height while sliding; obstacle bottom must clear this
export const SLIDE_DURATION = 0.8 // seconds player stays in slide pose
// Re-pressing SLIDE mid-slide restarts this timer (a fresh slide), so tapping
// repeatedly keeps the slide going.

// ─── Dash ─────────────────────────────────────────────────────────────────────
export const DASH_VELOCITY = 900 // px/s forward burst
export const DASH_DURATION = 0.16 // seconds of burst (kept short; snap-back follows)
export const DASH_COOLDOWN = 1.4 // seconds before dash can be used again

// ─── Scroll speed ─────────────────────────────────────────────────────────────
export const BASE_SPEED = 260 // px/s at game start
export const SPEED_RAMP = 10 // extra px/s per 10m — world accelerates over time

// ─── Near-miss combo ──────────────────────────────────────────────────────────
export const NEAR_MISS_DISTANCE = 22 // px gap between player right edge and obstacle left edge
export const COMBO_DECAY_TIME = 5.0 // seconds without a near-miss before combo resets

// ─── Damage / lives ───────────────────────────────────────────────────────────
export const START_LIVES = 3
export const INVINCIBLE_TIME = 1.5 // seconds of i-frames after a hit
export const DEATH_DELAY = 0.7 // seconds between final hit and game-over transition

// ─── Power-ups (GDD §VII) ──────────────────────────────────────────────────────
// Kopi Sachet (passive): 5s speed boost + immunity. Reuses the life-system
// invTimer for the immune window (so near-miss still fires, damage is skipped).
export const KOPI_DURATION = 5.0 // seconds of speed + immune
export const KOPI_SPEED_MULTIPLIER = 1.5 // applied on top of kasta + ramp
export const KOPI_INTERVAL = 22.0 // base seconds between kopi spawns (rare)

// Sandal Jepit (active): 3 ammo per pickup (reset, not accumulate). Each trigger
// destroys one upcoming obstacle for a small combo reward.
export const SANDAL_AMMO = 3
export const SANDAL_INTERVAL = 28.0 // base seconds between sandal spawns (rare)

// Heart collectible: restores 1 life if below max lives. Rare — rarer than kopi.
export const HEART_INTERVAL = 35.0 // base seconds between heart spawns

// ─── Obstacle spawning ────────────────────────────────────────────────────────
export const SPAWN_INTERVAL_MIN = 1.1 // seconds between spawns (minimum, shrinks with distance)
export const SPAWN_INTERVAL_MAX = 2.2

// ─── Kasta distance thresholds (meters) ──────────────────────────────────────
// To tune WHEN a kasta begins, edit KASTA_METERS at the top of kasta.js — that's
// the single knob. These named exports just re-expose the derived values for
// backward compatibility with existing callers.
import { KASTA_THRESHOLDS } from './kasta.js'
export const KASTA_AC_THRESHOLD = KASTA_THRESHOLDS.AC // Kipas Angin → AC Standar
export const KASTA_SINGGAH_THRESHOLD = KASTA_THRESHOLDS.SINGGAH // AC Standar → Singgahsini
export const KASTA_IMPIAN_THRESHOLD = KASTA_THRESHOLDS.IMPIAN // Singgahsini → Mode Kos Impian (endless)
