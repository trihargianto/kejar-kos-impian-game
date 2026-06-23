// ─── Collectibles ─────────────────────────────────────────────────────────────
// Three kinds, per GDD §VII (Greed Mechanic) + §VII Power-ups subsection:
//   coin   — "Recehan": fuels combo + currency (currency = budget for the
//             §IX reveal). Placed near obstacles so the greed line is risky.
//   kopi   — "Kopi Sachet" (passive power-up): 5s speed + immune on pickup.
//   sandal — "Sandal Jepit" (active power-up): resets ammo to 3 on pickup.
//
// Same scroll/offscreen contract as Obstacle so the play loop treats them
// uniformly. Collection is a circle-vs-AABB test in CollectibleSystem; the
// entity only owns position, draw, and a `collected` flag.
//
// Facility "tags" no longer exist as in-run collectibles; the §IX reveal is
// driven by coins (budget) + distance (tier), with facility chips rendered on
// the result screen. See systems/dreamKos.js.
import { roundRect } from '../core/utils.js'

const COIN_R = 11 // design-space radius
const KOPI_R = 20
const SANDAL_R = 22

export class Collectible {
  /**
   * @param {'coin'|'kopi'|'sandal'} kind
   * @param {object} game        provides scale + width
   * @param {number} runtimeY    y in RUNTIME px (already scaled, anchored to
   *                             game.floorY). NOT design space — the floor's
   *                             runtime position is a height-ratio, not
   *                             design*scale, so callers must pass a Y derived
   *                             from game.floorY or coins drift off the player.
   */
  constructor(kind, game, runtimeY) {
    const S = game.scale
    this.game = game
    this.kind = kind
    this.r = Math.round(radiusFor(kind) * S)
    this.y = Math.round(runtimeY)
    this.x = game.width + this.r * 2
    this.collected = false
    this._bob = 0
    this._labelSize = Math.round(9 * S)
  }

  // AABB so the shared aabb() helper / circle test can read uniform bounds.
  get bounds() {
    return { x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }
  }

  update(dt, speed) {
    this.x -= speed * dt
    this._bob += dt * 6
  }

  get offscreen() {
    return this.x + this.r < -50
  }

  draw(ctx) {
    const yb = this.y + Math.sin(this._bob) * (this.r * 0.18)

    // Sprite-first (GDD §XVI Step 4). Draw into the 2r×2r box centered on the
    // bobbing position; falls back to the primitive placeholder per kind below.
    const id = `item:${this.kind}`
    const sprite = this.game?.assets?.has(id) ? this.game.assets.image(id) : null
    if (sprite) {
      const d = this.r * 2
      ctx.drawImage(sprite, this.x - this.r, yb - this.r, d, d)
      return
    }

    if (this.kind === 'coin') {
      ctx.fillStyle = '#f1c40f'
      ctx.beginPath()
      ctx.arc(this.x, yb, this.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c79a08'
      ctx.beginPath()
      ctx.arc(this.x, yb, this.r * 0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f1c40f'
      ctx.font = `bold ${this.r}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Rp', this.x, yb)
      ctx.textBaseline = 'alphabetic'
      return
    }

    if (this.kind === 'kopi') {
      // Kopi Sachet — warm brown sachet shape (placeholder).
      ctx.fillStyle = '#6c3483'
      roundRect(ctx, this.x - this.r, yb - this.r, this.r * 2, this.r * 2, this.r * 0.3)
      ctx.strokeStyle = '#3a1c4a'
      ctx.lineWidth = Math.max(1, this.r * 0.1)
      ctx.beginPath()
      ctx.roundRect(this.x - this.r, yb - this.r, this.r * 2, this.r * 2, this.r * 0.3)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${this._labelSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('KOPI', this.x, yb)
      ctx.textBaseline = 'alphabetic'
      return
    }

    // sandal — flat flip-flop silhouette in blue (placeholder).
    ctx.fillStyle = '#2980b9'
    roundRect(ctx, this.x - this.r, yb - this.r * 0.7, this.r * 2, this.r * 1.4, this.r * 0.4)
    ctx.strokeStyle = '#1b4f72'
    ctx.lineWidth = Math.max(1, this.r * 0.1)
    ctx.beginPath()
    ctx.roundRect(this.x - this.r, yb - this.r * 0.7, this.r * 2, this.r * 1.4, this.r * 0.4)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${this._labelSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SNDL', this.x, yb)
    ctx.textBaseline = 'alphabetic'
  }
}

function radiusFor(kind) {
  if (kind === 'coin') return COIN_R
  if (kind === 'kopi') return KOPI_R
  if (kind === 'sandal') return SANDAL_R
  return KOPI_R
}
