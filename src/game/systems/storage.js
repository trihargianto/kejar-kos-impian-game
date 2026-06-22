// ─── Persistence ──────────────────────────────────────────────────────────────
// High-score storage via localStorage, guarded for private-mode / SSR failures.
// "Score" = jarak × combo multiplier (GDD §IV), the headline high-score number.
// Distance (m) is tracked separately for rank/kasta and is NOT persisted here.
const KEY = 'kki_highscore'

export function getHighScore() {
  try {
    const raw = window.localStorage.getItem(KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

// Persists score if it beats the stored best. Returns the resulting high score.
export function submitScore(score) {
  const best = getHighScore()
  if (score <= best) return best
  try {
    window.localStorage.setItem(KEY, String(score))
  } catch {
    // ignore write failures (private mode, quota)
  }
  return score
}
