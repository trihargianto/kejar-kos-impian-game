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

    // Reward telegraph: glow halo + bright ring + orbiting sparkles behind every
    // collectible so players instantly read "grab this" vs an obstacle to dodge.
    // Collectibles share a lane with obstacles by design (greed placement, GDD
    // §VII), so this cue — not position — is what distinguishes them.
    this._drawTelegraph(ctx, yb)

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

  // Reward telegraph. Tiered by rarity so the screen doesn't get noisy:
  //   coins   — spawn often → a soft gold glow only (calm, just enough to read
  //             as "grab").
  //   powerups— rare + important → full glow + bright ring + orbiting sparkles
  //             so they clearly stand out.
  // Pulse/orbit reuse the bob phase so it costs no extra state.
  _drawTelegraph(ctx, yb) {
    const t = this._bob
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.8)

    if (this.kind === 'coin') {
      // Subtle gold glow only.
      const gr = this.r * (1.5 + 0.15 * Math.sin(t * 0.8))
      const grad = ctx.createRadialGradient(this.x, yb, this.r * 0.3, this.x, yb, gr)
      grad.addColorStop(0, `rgba(255,205,50,${0.4 * pulse})`)
      grad.addColorStop(0.6, `rgba(255,205,50,${0.16 * pulse})`)
      grad.addColorStop(1, 'rgba(255,205,50,0)')
      ctx.save()
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(this.x, yb, gr, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    // Power-ups (kopi, sandal): full treatment in mint-green.
    const rgb = '70,235,165'
    ctx.save()

    // 1. Glow halo.
    const gr = this.r * (1.9 + 0.2 * Math.sin(t * 0.8))
    const grad = ctx.createRadialGradient(this.x, yb, this.r * 0.3, this.x, yb, gr)
    grad.addColorStop(0, `rgba(${rgb},${0.6 * pulse})`)
    grad.addColorStop(0.6, `rgba(${rgb},${0.25 * pulse})`)
    grad.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(this.x, yb, gr, 0, Math.PI * 2)
    ctx.fill()

    // 2. Bright ring hugging the item.
    ctx.lineWidth = Math.max(1.5, this.r * 0.22)
    ctx.strokeStyle = `rgba(${rgb},${0.85 * pulse})`
    ctx.beginPath()
    ctx.arc(this.x, yb, this.r * 1.32, 0, Math.PI * 2)
    ctx.stroke()

    // 3. Orbiting sparkles.
    const sparkles = 3
    const orbit = this.r * 1.55
    for (let i = 0; i < sparkles; i++) {
      const a = t * 1.2 + (i / sparkles) * Math.PI * 2
      const sx = this.x + Math.cos(a) * orbit
      const sy = yb + Math.sin(a) * orbit
      const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + i)
      ctx.fillStyle = `rgba(255,255,255,${0.85 * twinkle})`
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(1.2, this.r * 0.18 * twinkle), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }
}

function radiusFor(kind) {
  if (kind === 'coin') return COIN_R
  if (kind === 'kopi') return KOPI_R
  if (kind === 'sandal') return SANDAL_R
  return KOPI_R
}
