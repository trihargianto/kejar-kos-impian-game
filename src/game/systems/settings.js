// ─── Settings (source of truth) ───────────────────────────────────────────────
// In-game customization (GDD §Settings): audio (SFX on/off + volume) and a
// difficulty preset. Persisted to localStorage with the same private-mode/SSR
// guard pattern as storage.js. This module is the single place settings live;
// PlayScene + SpawnDirector + AudioSystem read from here.
//
// Difficulty scales PACE + SURVIVABILITY only — never the scoring formula
// (skor = jarak × combo stays comparable across players). Medium = the raw
// constants in constants.js (all multipliers 1.0).
const KEY = 'kki_settings'

// Per-preset multipliers applied over the constants.js baseline.
//   lives        absolute starting lives (not a multiplier — it's small + discrete)
//   speed        × BASE_SPEED
//   ramp         × SPEED_RAMP (acceleration over distance)
//   spawn        × SPAWN_INTERVAL_* (>1 = rarer/easier, <1 = denser/harder)
//   iframes      × INVINCIBLE_TIME (longer = more forgiving)
export const DIFFICULTY_PRESETS = Object.freeze({
  easy: { label: 'Easy', lives: 4, speed: 0.85, ramp: 0.8, spawn: 1.2, iframes: 1.3 },
  medium: { label: 'Medium', lives: 3, speed: 1.0, ramp: 1.0, spawn: 1.0, iframes: 1.0 },
  hard: { label: 'Hard', lives: 2, speed: 1.2, ramp: 1.3, spawn: 0.8, iframes: 0.85 },
})

export const DIFFICULTY_ORDER = Object.freeze(['easy', 'medium', 'hard'])

const DEFAULTS = Object.freeze({
  sfx: true, // SFX on/off
  difficulty: 'medium', // key into DIFFICULTY_PRESETS
})

// In-memory cache so callers don't hit localStorage every frame.
let _cache = null

// Validate + coerce a raw object into a well-formed settings record.
function _sanitize(raw) {
  const s = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) }
  s.sfx = !!s.sfx
  if (!DIFFICULTY_PRESETS[s.difficulty]) s.difficulty = DEFAULTS.difficulty
  return s
}

// Load settings (cached). Falls back to defaults on any read/parse failure.
export function loadSettings() {
  if (_cache) return _cache
  try {
    const raw = window.localStorage.getItem(KEY)
    _cache = _sanitize(raw ? JSON.parse(raw) : {})
  } catch {
    _cache = { ...DEFAULTS }
  }
  return _cache
}

// Merge a partial update, persist, and return the new settings. Updates the
// cache so subsequent reads are consistent without a round-trip.
export function saveSettings(partial) {
  const next = _sanitize({ ...loadSettings(), ...partial })
  _cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore write failures (private mode, quota) — cache still reflects intent
  }
  return next
}

// The active difficulty preset object (lives + multipliers).
export function activeDifficulty() {
  return DIFFICULTY_PRESETS[loadSettings().difficulty]
}

// Test-only: drop the cache so a fresh load re-reads storage.
export function _resetCache() {
  _cache = null
}
