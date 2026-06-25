// ─── Collectibles ─────────────────────────────────────────────────────────────
// Four kinds, per GDD §VII (Greed Mechanic) + §VII Power-ups subsection:
//   coin   — "Recehan": fuels combo + currency (currency = budget for the
//             §IX reveal). Placed near obstacles so the greed line is risky.
//   kopi   — "Kopi Sachet" (passive power-up): 5s speed + immune on pickup.
//   sandal — "Sandal Jepit" (active power-up): resets ammo to 3 on pickup.
//   heart  — Restores 1 life (capped at max lives for the current difficulty).
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
const HEART_R = 20

export class Collectible {
  /**
   * @param {'coin'|'kopi'|'sandal'|'heart'} kind
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
    // Cached telegraph glow gradient. Built in LOCAL space (centered at origin)
    // so it's position-independent and reusable across frames via ctx.translate.
    // Rebuilt only when the quantized glow radius changes (pulse crosses an
    // integer px) — avoids createRadialGradient per coin per frame (was the
    // single biggest per-frame allocation when many coins are on screen).
    this._glowGrad = null
    this._glowKey = -1
  }

  // Returns a radial gradient centered at (0,0) for the current glow radius.
  // `gr` is quantized to whole px so micro pulse changes reuse the cached object.
  _glow(ctx, gr, stops) {
    const key = gr | 0
    if (key !== this._glowKey) {
      const g = ctx.createRadialGradient(0, 0, this.r * 0.3, 0, 0, key)
      for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1])
      this._glowGrad = g
      this._glowKey = key
    }
    return this._glowGrad
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

    if (this.kind === 'sandal') {
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
      return
    }

    // heart — red heart shape drawn via bezier curves.
    ctx.save()
    ctx.fillStyle = '#e74c3c'
    const r = this.r
    ctx.beginPath()
    // Heart: two bumps on top, point at bottom.
    ctx.moveTo(this.x, yb + r * 0.55)
    ctx.bezierCurveTo(this.x - r * 1.1, yb - r * 0.1, this.x - r * 1.1, yb - r * 0.9, this.x, yb - r * 0.35)
    ctx.bezierCurveTo(this.x + r * 1.1, yb - r * 0.9, this.x + r * 1.1, yb - r * 0.1, this.x, yb + r * 0.55)
    ctx.fill()
    ctx.strokeStyle = '#c0392b'
    ctx.lineWidth = Math.max(1, r * 0.1)
    ctx.stroke()
    ctx.restore()
  }

  // Reward telegraph. Tiered by rarity so the screen doesn't get noisy:
  //   coins   — spawn often → a soft gold glow only (calm, just enough to read
  //             as "grab").
  //   heart   — life-restore → warm red glow (distinct from green power-up glow).
  //   powerups— rare + important → full glow + bright ring + orbiting sparkles
  //             so they clearly stand out.
  // Pulse/orbit reuse the bob phase so it costs no extra state.
  _drawTelegraph(ctx, yb) {
    const t = this._bob
    // One sin() for the slow pulse, reused for radius + alpha (was 2+ per coin).
    const slow = Math.sin(t * 0.8)
    const pulse = 0.7 + 0.3 * slow

    // Work in local space so the cached gradient (origin-centered) lines up;
    // the pulse fade rides on globalAlpha instead of being baked into stops,
    // which keeps the gradient object reusable frame-to-frame.
    ctx.save()
    ctx.translate(this.x, yb)

    if (this.kind === 'coin') {
      // Subtle gold glow only.
      const gr = this.r * (1.5 + 0.15 * slow)
      ctx.globalAlpha = pulse
      ctx.fillStyle = this._glow(ctx, gr, COIN_STOPS)
      ctx.beginPath()
      ctx.arc(0, 0, gr, 0, TWO_PI)
      ctx.fill()
      ctx.restore()
      return
    }

    // heart + power-ups share the full treatment; only palette differs.
    const heart = this.kind === 'heart'
    const stops = heart ? HEART_STOPS : POWER_STOPS
    const ring = heart ? '231,76,60' : '70,235,165'
    const sparkleRgb = heart ? '255,180,180' : '255,255,255'
    const sparkles = heart ? 4 : 3
    const spin = heart ? 1.4 : 1.2

    // 1. Glow halo.
    const gr = this.r * (1.9 + 0.2 * slow)
    ctx.globalAlpha = pulse
    ctx.fillStyle = this._glow(ctx, gr, stops)
    ctx.beginPath()
    ctx.arc(0, 0, gr, 0, TWO_PI)
    ctx.fill()

    // 2. Bright ring hugging the item.
    ctx.lineWidth = Math.max(1.5, this.r * 0.22)
    ctx.strokeStyle = `rgba(${ring},0.85)`
    ctx.beginPath()
    ctx.arc(0, 0, this.r * 1.32, 0, TWO_PI)
    ctx.stroke()
    ctx.globalAlpha = 1

    // 3. Orbiting sparkles.
    const orbit = this.r * 1.55
    const base = t * spin
    const dotMax = this.r * 0.18
    for (let i = 0; i < sparkles; i++) {
      const a = base + (i / sparkles) * TWO_PI
      const twinkle = 0.5 + 0.5 * Math.sin(t * 3 + i)
      ctx.fillStyle = `rgba(${sparkleRgb},${(heart ? 0.9 : 0.85) * twinkle})`
      ctx.beginPath()
      ctx.arc(Math.cos(a) * orbit, Math.sin(a) * orbit, Math.max(1.2, dotMax * twinkle), 0, TWO_PI)
      ctx.fill()
    }

    ctx.restore()
  }
}

const TWO_PI = Math.PI * 2
// Glow gradient color stops with FIXED alpha (pulse rides on globalAlpha so the
// gradient object stays cacheable). Stop offsets are radius-relative, so the
// same stops hold as the quantized glow radius changes.
const COIN_STOPS = [
  [0, 'rgba(255,205,50,0.4)'],
  [0.6, 'rgba(255,205,50,0.16)'],
  [1, 'rgba(255,205,50,0)'],
]
const HEART_STOPS = [
  [0, 'rgba(231,76,60,0.6)'],
  [0.6, 'rgba(231,76,60,0.25)'],
  [1, 'rgba(231,76,60,0)'],
]
const POWER_STOPS = [
  [0, 'rgba(70,235,165,0.6)'],
  [0.6, 'rgba(70,235,165,0.25)'],
  [1, 'rgba(70,235,165,0)'],
]

function radiusFor(kind) {
  if (kind === 'coin') return COIN_R
  if (kind === 'kopi') return KOPI_R
  if (kind === 'sandal') return SANDAL_R
  if (kind === 'heart') return HEART_R
  return KOPI_R
}
