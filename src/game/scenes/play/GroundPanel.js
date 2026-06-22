// ─── Ground panel ─────────────────────────────────────────────────────────────
// Fills the bottom-left of the (now taller) ground strip — the dead space left
// when the floor was raised to clear the control cluster on the right. Pure draw
// from a snapshot. Three layers:
//
//   1. Scrolling foreground detail — ground tiles/cracks scrolling FASTER than
//      the background (parallax), sells speed + depth. Spans the full strip.
//   2. Budget badge — total coins collected, shown as the rupiah BUDGET they buy
//      at the §IX reveal (coins ARE the budget, so we surface the real number
//      the run is building toward, not a bare "Rp 12" count that read as 12
//      rupiah). A small coin tally rides alongside.
//   3. KOPI boost chip — the active Kopi Sachet timer (SANDAL ammo lives on its
//      THROW button). The kasta name + progress now live entirely on the top
//      progress bar (HorizonGoal), so there's no tier text down here anymore.
//
// The cluster lives bottom-RIGHT, so these panels hug the LEFT to avoid it.
import { COLORS, FONTS } from '../../theme.js'
import { formatPrice } from '../../systems/dreamKos.js'

export class GroundPanel {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{width:number,height:number,scale:number,floorY:number,safeBottom:number}} game
   * @param {{dist:number, coins:number, budget:number, boostTimer:number}} snap
   */
  draw(ctx, game, snap) {
    this._drawScrollingGround(ctx, game, snap.dist)
    this._drawBudgetBadge(ctx, game, snap)
    this._drawBuffs(ctx, game, snap)
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

  // ── 2. Budget badge ──────────────────────────────────────────────────────────
  // The kos budget the run is earning (coins → rupiah). Labeled so it reads as a
  // budget, not "Rp <coin count>". A faint coin tally rides under it.
  _drawBudgetBadge(ctx, game, snap) {
    const { scale: S, floorY } = game
    const x = Math.round(12 * S)
    const y = floorY + Math.round(20 * S)
    const padX = Math.round(12 * S)

    // Headline: formatted budget, gold. Strip the "/bulan" suffix here — the run
    // is building a budget, the "/bulan" framing belongs on the reveal card.
    const budgetStr = formatPrice(snap.budget ?? 0).replace('/bulan', '')
    ctx.font = `bold ${Math.round(15 * S)}px ${FONTS.mono}`
    const cardW = ctx.measureText(budgetStr).width + padX * 2
    const cardH = Math.round(38 * S)

    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.roundRect(x, y, cardW, cardH, Math.round(8 * S))
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = COLORS.faint
    ctx.font = `${Math.round(8 * S)}px ${FONTS.mono}`
    ctx.fillText('MODAL KOS', x + padX, y + Math.round(13 * S))

    ctx.fillStyle = COLORS.gold
    ctx.font = `bold ${Math.round(15 * S)}px ${FONTS.mono}`
    ctx.fillText(budgetStr, x + padX, y + Math.round(30 * S))
  }

  // ── 3. KOPI boost chip ─────────────────────────────────────────────────────
  // Only while the Kopi Sachet window is active. Pill with a countdown so the
  // player knows how long the speed + immunity lasts. Sits just under the budget
  // badge (the kasta name moved to the top progress bar).
  _drawBuffs(ctx, game, snap) {
    if ((snap.boostTimer ?? 0) <= 0) return
    const { scale: S, floorY } = game
    const x = Math.round(12 * S)
    const chipY = floorY + Math.round(66 * S)
    const label = `KOPI ${snap.boostTimer.toFixed(1)}s`
    ctx.font = `bold ${Math.round(10 * S)}px ${FONTS.mono}`
    const padX = Math.round(8 * S)
    const w = ctx.measureText(label).width + padX * 2
    const h = Math.round(16 * S)

    ctx.fillStyle = '#6c3483'
    ctx.beginPath()
    ctx.roundRect(x, chipY, w, h, h / 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + padX, chipY + Math.round(11.5 * S))
  }
}
