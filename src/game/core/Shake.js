// ─── Screen shake ─────────────────────────────────────────────────────────────
// Decaying random offset applied to the canvas transform on impact events.
const MAX_DURATION = 0.25

export class Shake {
  constructor() {
    this.time = 0
    this.strength = 0
    this.duration = MAX_DURATION
    // Reused offset object — avoids one alloc per frame (called every draw).
    this._off = { x: 0, y: 0 }
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
    const o = this._off
    if (this.time <= 0) {
      o.x = 0
      o.y = 0
      return o
    }
    const s = this.strength * (this.time / this.duration)
    o.x = (Math.random() - 0.5) * s
    o.y = (Math.random() - 0.5) * s
    return o
  }
}
