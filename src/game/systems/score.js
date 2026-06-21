// ─── Scoring + progression (pure functions) ───────────────────────────────────
// All functions here are side-effect free and trivially testable.
import { getKastaDef } from '../kasta.js'

// Re-export kasta label map for callers that want a plain string lookup
// (e.g. the HUD currently uses `KASTA.KIPAS_ANGIN` as a label).
export { KASTA, getKastaDef } from '../kasta.js'

// Distance (m) → active kasta label string (e.g. "KIPAS ANGIN").
export function getKasta(dist) {
  return getKastaDef(dist).label
}

// Distance (m) → end-screen rank title.
export function getRank(dist) {
  if (dist < 100) return '🥴 Buronan Kelas Teri'
  if (dist < 500) return '😤 Suhu Tanggal Tua'
  if (dist < 1000) return '🔥 Buronan Kelas Kakap'
  return '🏆 Legenda Kos-Kosan'
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
