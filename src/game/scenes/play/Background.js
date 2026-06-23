// ─── Parallax background ──────────────────────────────────────────────────────
// The hallway behind the runner (GDD §VI: the kos evolves per kasta). Fills the
// SKY band only — y=0 down to the floor line (game.floorY). The floor strip
// below is drawn separately by Game.drawFloor + GroundPanel, so the background
// art must NOT include its own floor.
//
// Scroll is parallax: the wall drifts left SLOWER than the foreground ground
// (PARALLAX < the ground panel's multiplier) so there's real depth. Offset is
// derived from `dist` (monotonic) the same way GroundPanel does it, so it needs
// no per-frame state and is resume-safe.
//
// Per-kasta art (bg:<id>) is looked up by id; when missing, falls back to the
// flat KASTA_BG colour so the game still renders. Near a kasta boundary the two
// tiers crossfade so the tier change isn't a hard cut.
import { getKastaDef, getNextKastaDef, getNextKastaThreshold } from '../../kasta.js'
import { KASTA_BG } from '../../theme.js'

// Wall scrolls at this fraction of distance-units. Lower = further away / slower.
// The GroundPanel foreground uses ~14×; keeping the wall well under that sells
// the parallax depth.
const PARALLAX = 4

// Crossfade window (meters) before a kasta threshold: blend current → next.
const FADE_METERS = 60

// Dark scrim over the wall so foreground (score, obstacles, items, player) pops.
// The wall art is busy/bright; without this it competes with gameplay. It's a
// vertical gradient — strongest at the TOP (behind the HUD: lives, distance,
// score, kasta bar) where readability matters most, easing to a light haze over
// the play area so obstacles still read against a calmer wall.
const SCRIM_TOP = 0.68 // darkness at the very top (behind the HUD)
const SCRIM_BOTTOM = 0.38 // darkness near the floor line

export class Background {
  // Draw the parallax wall for the current distance. Pure from (dist).
  draw(ctx, game, dist) {
    const cur = getKastaDef(dist)
    const next = getNextKastaDef(dist)
    const nextAt = getNextKastaThreshold(dist)

    // Base layer: current kasta, fully opaque.
    this._drawLayer(ctx, game, dist, cur, 1)

    // Crossfade into the next kasta as we approach its threshold.
    if (next && nextAt != null) {
      const dToGate = nextAt - dist
      if (dToGate <= FADE_METERS) {
        const t = 1 - dToGate / FADE_METERS // 0 → 1 as we reach the gate
        this._drawLayer(ctx, game, dist, next, t)
      }
    }

    // Scrim: only meaningful once a real wall sprite is up (the flat-colour
    // fallback is already calm). A top-heavy gradient darkens the sky band so
    // gameplay — and especially the HUD up top — reads clearly over the wall.
    if (game.assets?.has(`bg:${cur.id}`)) {
      const grad = ctx.createLinearGradient(0, 0, 0, game.floorY)
      grad.addColorStop(0, `rgba(0,0,0,${SCRIM_TOP})`)
      grad.addColorStop(1, `rgba(0,0,0,${SCRIM_BOTTOM})`)
      ctx.save()
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, game.width, game.floorY)
      ctx.restore()
    }
  }

  // Draw one kasta's wall at the given alpha. Uses the sprite if present, else
  // fills the sky band with the kasta's flat colour.
  _drawLayer(ctx, game, dist, kasta, alpha) {
    const { width: W, floorY } = game
    const id = `bg:${kasta.id}`
    const sprite = game.assets?.has(id) ? game.assets.image(id) : null

    ctx.save()
    ctx.globalAlpha = alpha

    if (!sprite) {
      ctx.fillStyle = KASTA_BG[kasta.label] ?? kasta.bg
      ctx.fillRect(0, 0, W, floorY)
      ctx.restore()
      return
    }

    // Scale the wall to the sky band height; width follows the sprite ratio.
    const bandH = floorY
    const tileW = Math.max(1, Math.round(bandH * (sprite.width / sprite.height)))
    // Parallax scroll: drift left with distance, wrapped to one tile width.
    const offset = ((dist * PARALLAX * game.scale) % tileW + tileW) % tileW

    // Tile across the width, starting one tile left so the wrap seam is covered.
    for (let x = -offset; x < W; x += tileW) {
      ctx.drawImage(sprite, x, 0, tileW, bandH)
    }
    ctx.restore()
  }
}
