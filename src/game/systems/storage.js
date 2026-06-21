// ─── Persistence ──────────────────────────────────────────────────────────────
// High-score storage via localStorage, guarded for private-mode / SSR failures.
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

// Persists dist if it beats the stored best. Returns the resulting high score.
export function submitScore(dist) {
  const best = getHighScore()
  if (dist <= best) return best
  try {
    window.localStorage.setItem(KEY, String(dist))
  } catch {
    // ignore write failures (private mode, quota)
  }
  return dist
}
