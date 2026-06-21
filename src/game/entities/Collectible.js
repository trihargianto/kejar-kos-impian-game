// ─── Collectibles ─────────────────────────────────────────────────────────────
// Two kinds, per GDD §VII (Greed Mechanic):
//   coin  — "Recehan": fuels combo + currency, placed near obstacles.
//   item  — "Item Kos Impian": facility tags (AC, wifi, dekat kampus, ...) that
//           build the player's dream-kos profile for the end-of-run reveal (§IX).
//
// Same scroll/offscreen contract as Obstacle so the play loop treats them
// uniformly. Collection is a circle-vs-AABB test in CollectibleSystem; the
// entity only owns position, draw, and a `collected` flag.
import { roundRect } from '../core/utils.js'

// Facility tags a dream-kos item can carry. The reveal (§IX) matches the set
// the player collected against real Mamikos listings (or the curated fallback).
export const FACILITY_TAGS = Object.freeze([
  { id: 'ac', label: 'AC', icon: 'AC' },
  { id: 'wifi', label: 'WiFi', icon: 'WiFi' },
  { id: 'kampus', label: 'Dekat Kampus', icon: 'Kampus' },
  { id: 'km_dalam', label: 'K. Mandi Dalam', icon: 'KM' },
  { id: 'parkir', label: 'Parkir Luas', icon: 'Parkir' },
  { id: 'dapur', label: 'Dapur', icon: 'Dapur' },
])

const COIN_R = 11 // design-space radius
const ITEM_R = 18

export class Collectible {
  /**
   * @param {'coin'|'item'} kind
   * @param {object} game        provides scale + width
   * @param {number} designY     y in design space (390-wide baseline)
   * @param {object|null} tag     facility tag (item only); ignored for coins
   */
  constructor(kind, game, designY, tag = null) {
    const S = game.scale
    this.kind = kind
    this.tag = tag
    this.r = Math.round((kind === 'coin' ? COIN_R : ITEM_R) * S)
    this.y = Math.round(designY * S)
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

    // Dream-kos item — a teal tag chip with the facility name.
    ctx.fillStyle = '#16a085'
    roundRect(ctx, this.x - this.r, yb - this.r, this.r * 2, this.r * 2, this.r * 0.5)
    ctx.strokeStyle = '#0e6655'
    ctx.lineWidth = Math.max(1, this.r * 0.12)
    ctx.beginPath()
    ctx.roundRect(this.x - this.r, yb - this.r, this.r * 2, this.r * 2, this.r * 0.5)
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${this._labelSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.tag?.icon ?? '?', this.x, yb)
    ctx.textBaseline = 'alphabetic'
  }
}
