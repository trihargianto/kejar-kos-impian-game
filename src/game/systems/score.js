// ─── Scoring + progression (pure functions) ───────────────────────────────────
import {
  KASTA_AC_THRESHOLD,
  KASTA_SINGGAH_THRESHOLD,
  KASTA_IMPIAN_THRESHOLD,
} from '../constants.js'

export const KASTA = {
  KIPAS_ANGIN: 'KIPAS ANGIN',
  AC_STANDAR: 'AC STANDAR',
  SINGGAHSINI: 'SINGGAHSINI',
  KOS_IMPIAN: 'KOS IMPIAN',
}

// Distance (m) → kasta tier label.
export function getKasta(dist) {
  if (dist < KASTA_AC_THRESHOLD) return KASTA.KIPAS_ANGIN
  if (dist < KASTA_SINGGAH_THRESHOLD) return KASTA.AC_STANDAR
  if (dist < KASTA_IMPIAN_THRESHOLD) return KASTA.SINGGAHSINI
  return KASTA.KOS_IMPIAN
}

// Final distance (m) → end-screen rank title.
export function getRank(dist) {
  if (dist < 100) return '🥴 Buronan Kelas Teri'
  if (dist < 500) return '😤 Suhu Tanggal Tua'
  if (dist < 1000) return '🔥 Buronan Kelas Kakap'
  return '🏆 Legenda Kos-Kosan'
}

const MAX_MULT = 32

// Combo count → score multiplier (doubles every 2 near-misses, capped).
export function comboMultiplier(combo) {
  return Math.min(Math.pow(2, Math.floor(combo / 2)), MAX_MULT)
}

// Combo count → flavor text shown on a near-miss.
export function nearMissText(combo) {
  if (combo <= 2) return 'Nyaris!'
  if (combo <= 6) return 'GILA!'
  return 'DPO!'
}
