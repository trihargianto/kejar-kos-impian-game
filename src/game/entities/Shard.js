// ─── Shard ──────────────────────────────────────────────────────────────────
// Short-lived debris piece for a "shatter" burst — e.g. a door breaking on a
// dash or a Kopi smash. Conforms to the same update(dt)/dead()/draw(ctx)
// contract as FloatText so the scene can drop a handful into `game.floats` and
// the main loop updates + renders + culls them with no extra wiring.
//
// Each shard is a small rotating rounded rect that flies out on a gravity arc
// and fades. `Shard.burst(...)` builds a whole spray at once.
import { roundRect } from '../core/utils.js'

const GRAVITY = 1500 // px/s² (in scaled px — caller passes scale-aware speeds)
const FADE = 1.8 // life drains ~1/FADE per second of visible time

export class Shard {
  constructor(x, y, vx, vy, size, color, rotV) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.size = size
    this.color = color
    this.rot = 0
    this.rotV = rotV
    this.life = 1.0
  }

  update(dt) {
    this.vy += GRAVITY * dt
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.rot += this.rotV * dt
    this.life -= dt * FADE
  }

  dead() {
    return this.life <= 0
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.life)
    ctx.translate(this.x, this.y)
    ctx.rotate(this.rot)
    ctx.fillStyle = this.color
    roundRect(ctx, -this.size / 2, -this.size / 2, this.size, this.size, this.size * 0.25)
    ctx.restore()
  }

  // Build a spray of shards exploding from (cx, cy). `scale` keeps the burst
  // proportional to the frame; `color` matches the shattered object so the
  // debris reads as "that thing broke". Returns an array to push into floats.
  static burst(cx, cy, color, scale = 1, count = 10) {
    const shards = []
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4 // mostly upward
      const speed = (200 + Math.random() * 320) * scale
      const size = (5 + Math.random() * 9) * scale
      const rotV = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 8)
      shards.push(
        new Shard(cx, cy, Math.cos(angle) * speed, Math.sin(angle) * speed, size, color, rotV)
      )
    }
    return shards
  }
}
