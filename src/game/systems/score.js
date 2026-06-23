// ─── Scoring + progression (pure functions) ───────────────────────────────────
// All functions here are side-effect free and trivially testable.
import { getKastaDef, KASTA_METERS } from '../kasta.js'

// Re-export kasta label map for callers that want a plain string lookup
// (e.g. the HUD currently uses `KASTA.KIPAS_ANGIN` as a label).
export { KASTA, getKastaDef } from '../kasta.js'

// Distance (m) → active kasta label string (e.g. "KIPAS ANGIN").
export function getKasta(dist) {
  return getKastaDef(dist).label
}

// Comedic end-screen ranks. The boundaries are DERIVED from KASTA_METERS (the
// single source of truth) so retuning the kasta thresholds moves the ranks with
// them — one rank per kasta tier, no parallel set of magic numbers to keep in
// sync. Order matches the kasta order (Kipas Angin → AC → Singgahsini → Impian).
export const RANK_TITLES = Object.freeze([
  '🥴 Buronan Kelas Teri', // Kipas Angin
  '😤 Suhu Tanggal Tua', // AC Standar
  '🔥 Buronan Kelas Kakap', // Singgahsini
  '🏆 Legenda Kos-Kosan', // Kos Impian (gate+)
])

// Distance (m) → end-screen rank title, gated on the kasta thresholds.
export function getRank(dist) {
  if (dist < KASTA_METERS.AC_STANDAR) return RANK_TITLES[0]
  if (dist < KASTA_METERS.SINGGAHSINI) return RANK_TITLES[1]
  if (dist < KASTA_METERS.KOS_IMPIAN) return RANK_TITLES[2]
  return RANK_TITLES[3]
}

// Combo count → score multiplier. Cap is per-kasta (from KASTA_DEFS).
// Defaults to the first tier's cap if no def supplied.
export function comboMultiplier(combo, cap = 8) {
  return Math.min(Math.pow(2, Math.floor(combo / 2)), cap)
}

// Combo count → flavor text shown on a near-miss.
export function nearMissText(combo) {
  if (combo <= 2) return 'Nyaris!'
  if (combo <= 6) return 'GILA!'
  return 'DPO!'
}
