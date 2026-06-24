// ─── Sandal Jepit projectile (GDD §VII Active) ────────────────────────────────
// Spawned by PlayScene._throwSandal when the player triggers a throw. Flies
// right from the player toward the locked target obstacle, spinning like a
// real thrown flip-flop. On arrival, destroys the obstacle and the scene
// applies the small combo + VFX.
//
// If the target disappears before impact (player dashed through it, another
// sandal got there first, it scrolled off-screen), the sandal keeps flying
// and expires off the right edge — the throw still "looked right" even if it
// no longer hits anything.
import { roundRect } from '../core/utils.js'

const SANDAL_W = 38 // design px
const SANDAL_H = 24
// Tuned for readability: at 700 px/s the sandal crosses the 390px screen in
// ~0.56s, enough to register the throw + spin. Still fast enough to catch
// any obstacle — even at Mode Kos Impian (~1890 px/s scroll), the closing
// rate of 700 + 1890 = 2590 px/s clears a 360px gap in ~0.14s.
const SANDAL_SPEED = 700 // design px/s
const SPIN_RATE = 16 // rad/s — ~2.5 flips per second, readable but energetic

export class SandalProjectile {
  /**
   * @param {object} game    provides scale + width
   * @param {{x:number, y:number, w:number, h:number}} origin  AABB the sandal launches from (player.bounds)
   * @param {object|null} target  the obstacle def the sandal is homing in on; may be null
   */
  constructor(game, origin, target = null) {
    const S = game.scale
    this.w = Math.round(SANDAL_W * S)
    this.h = Math.round(SANDAL_H * S)
    // Launch from the player's right edge, vertically centered on the torso.
    this.x = origin.x + origin.w
    this.y = origin.y + origin.h * 0.5
    this.speed = SANDAL_SPEED * S
    this.target = target
    this._spin = 0
    this.dead = false
  }

  /**
   * Step the projectile. Returns:
   *   { hit: true,  obstacle } — sandal reached its target this frame; scene
   *                              applies combo/VFX and decides removal vs.
   *                              knock-away (door shatters, others get flung).
   *   { hit: false }            — sandal expired off-screen without impact
   *   null                      — still flying
   *
   * `obstacles` is the scene's live array; read (not mutated) to detect impact.
   */
  update(dt, game, obstacles) {
    this.x += this.speed * dt
    this._spin += dt * SPIN_RATE

    if (this.target) {
      const idx = obstacles.indexOf(this.target)
      // Target already knocked away (e.g. a Kopi smash got it first) → treat as
      // gone: keep flying and expire off the right edge, no double-hit.
      if (this.target.knocked) {
        this.target = null
      } else if (idx >= 0) {
        const t = this.target
        // Impact the instant the sandal's nose crosses the target's left edge.
        // Catches even fast-scrolling targets within a frame. The scene owns
        // removal (door → shatter+remove; other → knock-away, stays in array).
        if (this.x + this.w / 2 >= t.x) {
          this.dead = true
          return { hit: true, obstacle: t }
        }
      } else {
        // Target was destroyed by something else mid-flight. Keep flying so
        // the throw visually completes; expire at the right edge below.
        this.target = null
      }
    }

    if (this.x - this.w / 2 > game.width + 20 * game.scale) {
      this.dead = true
      return { hit: false }
    }
    return null
  }

  draw(ctx) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this._spin)
    // Sole (matches the Collectible 'sandal' kind palette so they read as the
    // same object — pickup vs thrown).
    ctx.fillStyle = '#2980b9'
    roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, this.h * 0.4)
    ctx.strokeStyle = '#1b4f72'
    ctx.lineWidth = Math.max(1, this.w * 0.05)
    ctx.beginPath()
    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, this.h * 0.4)
    ctx.stroke()
    // V-strap (the flip-flop Y strap) — the part that makes a sandal read as
    // a sandal even mid-spin.
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(1, this.h * 0.16)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-this.w * 0.12, -this.h / 2)
    ctx.lineTo(0, 0)
    ctx.lineTo(this.w * 0.12, -this.h / 2)
    ctx.stroke()
    ctx.restore()
  }
}
