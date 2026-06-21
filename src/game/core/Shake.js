// ─── Screen shake ─────────────────────────────────────────────────────────────
// Decaying random offset applied to the canvas transform on impact events.
const MAX_DURATION = 0.25

export class Shake {
  constructor() {
    this.time = 0
    this.strength = 0
    this.duration = MAX_DURATION
  }

  trigger(strength = 8, duration = MAX_DURATION) {
    this.strength = strength
    this.time = duration
    this.duration = duration
  }

  update(dt) {
    if (this.time > 0) this.time -= dt
  }

  offset() {
    if (this.time <= 0) return { x: 0, y: 0 }
    const s = this.strength * (this.time / this.duration)
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s }
  }
}
