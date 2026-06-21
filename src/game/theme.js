// ─── Visual theme ───────────────────────────────────────────────────────────
// All colors, fonts, and layout ratios live here so a reskin touches one file.

export const COLORS = {
  player: '#e74c3c',
  playerEye: '#fff',
  playerPupil: '#222',
  floor: '#8b6914',
  floorLine: '#5a4010',
  ink: '#1a1a1a',
  inkSoft: '#222',
  muted: '#555',
  mutedSoft: '#777',
  faint: '#aaa',
  accent: '#e74c3c',
  gold: '#f1c40f',
  green: '#27ae60',
  white: '#fff',
  gameoverBg: '#1a1a2e',
  gameoverTitle: '#e74c3c',
  gameoverDist: '#f1c40f',
  gameoverRank: '#eee',
}

// Background tint per kasta tier (keyed by kasta label).
export const KASTA_BG = {
  'KIPAS ANGIN': '#e8d5b0',
  'AC STANDAR': '#d4ecd4',
  SINGGAHSINI: '#d4e4f0',
  'KOS IMPIAN': '#ede0ff',
}

export const FONTS = {
  mono: 'monospace',
  sans: 'sans-serif',
}

// Pulse for blinking call-to-action text (0.4..1.0).
export function ctaPulse(timeSec) {
  return 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 2.5))
}
