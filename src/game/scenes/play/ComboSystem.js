// ─── Combo system ─────────────────────────────────────────────────────────────
// Near-miss tracking + multiplier + decay. Pure-ish: holds state but mutates
// only via the documented API (gain(), break(), update(dt)).
//
// The cap is per-kasta — Singgahsini allows higher multipliers than Kipas
// Angin, and Mode Kos Impian releases the cap entirely. Pass the current kasta
// def to update() so the cap is always live.
//
// Score wiring verification (Area 3): score = dM × combo.mult per frame, so the
// curve + caps directly govern how swingy score feels. Re-checked after the
// score accumulator landed:
//   • Curve `2^floor(combo/2)` doubles every 2 near-misses; per-tier caps
//     (8/16/24/∞) bound swinginess inside a tier. Unchanged — feels right.
//   • gainSmall (sandal) advances combo but does NOT recompute mult, so a
//     sandal-only run scores at mult=1 (no near-miss → no doubling). Near-miss
//     strictly outscores sandal-spam; sandal's role is to bridge decay gaps.
//   • Greed loop payoff ranking holds:
//       aggressive near-miss + greedy coin grab > safe coin grab > pure dodge
//     Greedy coins call gain() (full combo event), which is what makes them
//     "greedy" — the mult payoff pulls the player into traffic. A safe grabber
//     who skips risky coins hits fewer combo events per meter, so their mult
//     ramps slower and they score less even if they reach the same cap.
//   • COMBO_DECAY_TIME = 5.0s matches the GDD; no change.
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

  // Smaller reward for Sandal Jepit destroy (GDD §VII "combo kecil"):
  // advances the combo counter + resets the decay timer, but does NOT
  // recompute the multiplier. Near-miss remains the strictly-better path
  // for score; sandal just keeps the chain alive + contributes a little.
  // `kastaDef` is accepted for API symmetry with gain() even though small
  // gains don't read the cap today — tier-specific tuning can land later
  // without touching every caller.
  // eslint-disable-next-line no-unused-vars
  gainSmall(kastaDef) {
    this.combo++
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
