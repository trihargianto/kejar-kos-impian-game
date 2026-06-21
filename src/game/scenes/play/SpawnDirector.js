// ─── Spawn director ───────────────────────────────────────────────────────────
// Owns spawn cadence + obstacle stream. Kasta-aware so each tier can adjust
// spawn rate / obstacle pool / pattern selection without touching PlayScene.
//
// Today: timer-based spawning with shrinking interval as distance grows.
// Tomorrow: pattern-aware spawning (telegraph one verb at a time during
// tutorial kasta, then mixed verbs later) lives here, not in the scene.
import { SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX } from '../../constants.js'
import { getKastaDef } from '../../kasta.js'
import { Obstacle } from '../../entities/Obstacle.js'
import { lerp } from '../../core/utils.js'

export class SpawnDirector {
  constructor() {
    this.timer = 0
  }

  reset() {
    this.timer = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
  }

  // Returns an Obstacle to spawn this frame, or null if not yet time.
  // `game` provides scale/floorY/width for the new obstacle.
  // `dist` is the current distance (m), used to shrink intervals.
  update(dt, game, dist) {
    this.timer -= dt
    if (this.timer > 0) return null

    const kasta = getKastaDef(dist)
    const base = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
    const accelerated = Math.max(0.5, base - dist * 0.00012)
    this.timer = accelerated * (kasta.spawnIntervalMultiplier ?? 1)

    // Kasta twist (GDD §VI): once the vacuum mechanic is live (Singgahsini+),
    // a slice of spawns become the floor-chasing robot vacuum.
    if (kasta.mechanics?.vacuum && Math.random() < 0.35) {
      const v = Obstacle.special('vacuum', game)
      if (v) return v
    }

    return Obstacle.random(game)
  }
}
