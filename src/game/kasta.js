// ─── Kasta definitions (data-driven) ──────────────────────────────────────────
// One tier = one record. Per-kasta mechanics (lantai licin, vacuum, smart-lock,
// endless sprint) become config + flags here, not branchy code in PlayScene.
//
// To add a new tier: append a record. To tweak a mechanic: edit the record.
// `getKastaDef(dist)` returns the active record so consumers don't need a
// switch chain. `KASTA_DEFS` is the source of truth; constants.js thresholds
// are derived from it below.

export const KASTA_DEFS = Object.freeze([
  {
    id: 'kipas_angin',
    label: 'KIPAS ANGIN',
    fromMeters: 0,
    bg: '#e8d5b0',
    speedMultiplier: 1.0,
    frictionMultiplier: 1.0,
    spawnIntervalMultiplier: 1.0,
    comboMultiplierCap: 8,
    // Phase 1: tutorial-safe; wide gaps, no twist.
    mechanics: { slippery: false, vacuum: false, smartLock: false, endless: false },
  },
  {
    id: 'ac_standar',
    label: 'AC STANDAR',
    fromMeters: 300,
    bg: '#d4ecd4',
    speedMultiplier: 1.1,
    frictionMultiplier: 0.4, // lantai licin: less friction → momentum carries
    spawnIntervalMultiplier: 0.95,
    comboMultiplierCap: 16,
    mechanics: { slippery: true, vacuum: false, smartLock: false, endless: false },
  },
  {
    id: 'singgahsini',
    label: 'SINGGAHSINI',
    fromMeters: 700,
    bg: '#d4e4f0',
    speedMultiplier: 1.25,
    frictionMultiplier: 1.0,
    spawnIntervalMultiplier: 0.85,
    comboMultiplierCap: 24,
    mechanics: { slippery: false, vacuum: true, smartLock: true, endless: false },
  },
  {
    id: 'kos_impian',
    label: 'KOS IMPIAN',
    fromMeters: 1000,
    bg: '#ede0ff',
    speedMultiplier: 1.5,
    frictionMultiplier: 1.0,
    spawnIntervalMultiplier: 0.7,
    comboMultiplierCap: Infinity, // cap released
    mechanics: { slippery: false, vacuum: false, smartLock: false, endless: true },
  },
])

export const KASTA = Object.freeze(
  KASTA_DEFS.reduce((acc, def) => {
    acc[def.id.toUpperCase()] = def.label
    return acc
  }, {}),
)

// Distance (m) → active kasta definition (the highest tier whose fromMeters ≤ dist).
export function getKastaDef(dist) {
  let active = KASTA_DEFS[0]
  for (const def of KASTA_DEFS) {
    if (dist >= def.fromMeters) active = def
    else break
  }
  return active
}

// Distance (m) → previous kasta definition, or null if still on the first tier.
export function getPreviousKastaDef(dist) {
  let prev = null
  for (const def of KASTA_DEFS) {
    if (dist < def.fromMeters) break
    if (def !== getKastaDef(dist)) prev = def
  }
  return prev
}

// Distance (m) → next kasta threshold, or null if final tier reached.
export function getNextKastaThreshold(dist) {
  for (const def of KASTA_DEFS) {
    if (def.fromMeters > dist) return def.fromMeters
  }
  return null
}

// Re-export thresholds for backward compatibility with constants.js consumers.
export const KASTA_THRESHOLDS = Object.freeze({
  AC: KASTA_DEFS[1].fromMeters,
  SINGGAH: KASTA_DEFS[2].fromMeters,
  IMPIAN: KASTA_DEFS[3].fromMeters,
})
