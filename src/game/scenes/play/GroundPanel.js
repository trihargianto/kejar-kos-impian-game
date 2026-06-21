// ─── Ground panel ─────────────────────────────────────────────────────────────
// Fills the bottom-left of the (now taller) ground strip — the dead space left
// when the floor was raised to clear the control cluster on the right. Three
// layers, all pure draw from a snapshot:
//
//   1. Scrolling foreground detail — ground tiles/cracks scrolling FASTER than
//      the background (parallax), sells speed + depth. Spans the full strip.
//   2. Coin badge — Recehan currency, bottom-left card (distance is top-center).
//   3. Dream-kos tracker — current kasta tier + facility tags collected this run
//      (most first). Progress toward the next tier is the top bar (HorizonGoal).
//
// The cluster lives bottom-RIGHT, so panels 2–3 hug the LEFT to avoid it.
import { COLORS, FONTS } from '../../theme.js'
import { getKastaDef } from '../../kasta.js'

export class GroundPanel {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{width:number,height:number,scale:number,floorY:number,safeBottom:number}} game
   * @param {{dist:number, coins:number, dreamProfile:Array<{label:string,count:number}>}} snap
   */
  draw(ctx, game, snap) {
    this._drawScrollingGround(ctx, game, snap.dist)
    this._drawCoinBadge(ctx, game, snap)
    this._drawDreamTracker(ctx, game, snap)
  }

  // ── 1. Parallax foreground tiles ────────────────────────────────────────────
  // Short dashes on the ground that scroll left faster than the world, so the
  // strip reads as rushing past. Offset is derived from `dist` (monotonic) so it
  // animates without per-frame state. Kasta-tinted to match the tier mood.
  _drawScrollingGround(ctx, game, dist) {
    const { width: W, scale: S, floorY } = game
    const stripTop = floorY + Math.round(10 * S)
    const tileW = Math.round(34 * S)
    const gap = Math.round(22 * S)
    const period = tileW + gap
    // Faster than the world: multiply distance so the foreground outruns the bg.
    const offset = Math.round((dist * 14 * S) % period)
    const y = stripTop
    const h = Math.max(2, Math.round(3 * S))

    ctx.save()
    ctx.fillStyle = COLORS.floorLine
    ctx.globalAlpha = 0.5
    for (let x = -period + ((W - offset) % period); x < W; x += period) {
      ctx.fillRect(x, y, tileW, h)
    }
    // A second, sparser, faster row deeper in the strip for layered depth.
    const offset2 = Math.round((dist * 20 * S) % (period * 2))
    ctx.globalAlpha = 0.28
    for (let x = -period * 2 + ((W - offset2) % (period * 2)); x < W; x += period * 2) {
      ctx.fillRect(x, y + Math.round(16 * S), Math.round(tileW * 1.6), h)
    }
    ctx.restore()
  }

  // ── 2. Coin + distance badge ────────────────────────────────────────────────
  _drawCoinBadge(ctx, game, snap) {
    const { scale: S, floorY } = game
    const x = Math.round(12 * S)
    const y = floorY + Math.round(20 * S)
    const padX = Math.round(12 * S)
    const padY = Math.round(8 * S)

    // Coins only — distance lives in the top-center score, so it's not repeated.
    ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
    const coinStr = `Rp ${snap.coins}`
    const cardW = ctx.measureText(coinStr).width + padX * 2

    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.roundRect(x, y, cardW, Math.round(28 * S), Math.round(8 * S))
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.gold
    ctx.fillText(coinStr, x + padX, y + padY + Math.round(13 * S))
  }

  // ── 3. Dream-kos tracker ─────────────────────────────────────────────────────
  // Current kasta tier + facility tag chips collected this run (most-collected
  // first, capped). Reinforces the goal: you're assembling a dream kos.
  _drawDreamTracker(ctx, game, snap) {
    const { scale: S, floorY } = game
    const x = Math.round(12 * S)
    const y = floorY + Math.round(58 * S)

    // Heading shows the CURRENT kasta tier (replaces the old standalone
    // "KASTA: …" HUD line). Progress toward the next tier is the top bar
    // (HorizonGoal), so this widget is just tier + collected facility chips.
    const kasta = getKastaDef(snap.dist)
    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.mutedSoft
    ctx.font = `bold ${Math.round(10 * S)}px ${FONTS.mono}`
    ctx.fillText(`KASTA: ${kasta.label}`, x, y)

    // Tag chips — up to 4, most-collected first. Empty state nudges collecting.
    const tags = (snap.dreamProfile || []).slice(0, 4)
    const chipY = y + Math.round(8 * S)
    const chipH = Math.round(18 * S)
    let cx = x
    if (tags.length === 0) {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${Math.round(10 * S)}px ${FONTS.mono}`
      ctx.fillText('kumpulkan fasilitas…', x, chipY + Math.round(13 * S))
    } else {
      ctx.font = `${Math.round(10 * S)}px ${FONTS.mono}`
      for (const t of tags) {
        const label = t.count > 1 ? `${t.label} ×${t.count}` : t.label
        const tw = ctx.measureText(label).width
        const chipW = tw + Math.round(14 * S)
        ctx.fillStyle = 'rgba(22,160,133,0.85)' // facility teal
        ctx.beginPath()
        ctx.roundRect(cx, chipY, chipW, chipH, Math.round(9 * S))
        ctx.fill()
        ctx.fillStyle = COLORS.white
        ctx.fillText(label, cx + Math.round(7 * S), chipY + Math.round(13 * S))
        cx += chipW + Math.round(6 * S)
      }
    }
  }
}
