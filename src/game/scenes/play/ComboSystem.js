// ─── Combo system ─────────────────────────────────────────────────────────────
// Near-miss tracking + multiplier + decay. Pure-ish: holds state but mutates
// only via the documented API (gain(), break(), update(dt)).
//
// The cap is per-kasta — Singgahsini allows higher multipliers than Kipas
// Angin, and Mode Kos Impian releases the cap entirely. Pass the current kasta
// def to update() so the cap is always live.
import { COMBO_DECAY_TIME } from '../../constants.js'
import { comboMultiplier as computeMult } from '../../systems/score.js'

export class ComboSystem {
  constructor() {
    this.combo = 0
    this.mult = 1
    this.timer = 0
  }

  // Called at scene enter. Same as clear() but the intent is explicit and we
  // don't care about the previous value.
  reset() {
    this.clear()
  }

  // Register a near-miss; returns the new combo count + multiplier.
  gain(kastaDef) {
    this.combo++
    const cap = kastaDef?.comboMultiplierCap ?? 8
    this.mult = computeMult(this.combo, cap)
    this.timer = 0
    return { combo: this.combo, mult: this.mult }
  }

  // Force a reset (e.g. on damage). Returns the previous combo count so callers
  // can emit COMBO_BREAK only when there was actually something to break.
  clear() {
    const had = this.combo
    this.combo = 0
    this.mult = 1
    this.timer = 0
    return had
  }

  update(dt) {
    if (this.combo === 0) return
    this.timer += dt
    if (this.timer > COMBO_DECAY_TIME) {
      this.combo = 0
      this.mult = 1
    }
  }

  get active() {
    return this.combo > 0
  }
}
