// ─── HUD ──────────────────────────────────────────────────────────────────────
// Draws the in-play HUD: lives (top-left), distance + combo (top-center),
// kasta label (bottom-left), dash cooldown (bottom-right), and the controls
// hint shown until the first input. Pure draw — owns no game state.
//
// Receives a snapshot each frame from PlayScene so it stays trivially testable.
import { COLORS, FONTS } from '../../theme.js'
import { START_LIVES } from '../../constants.js'

/**
 * @typedef {Object} HudSnapshot
 * @property {number} lives
 * @property {number} dist
 * @property {number} combo
 * @property {number} mult
 * @property {string} kastaLabel
 * @property {number} dashCd
 * @property {boolean} showControls
 */

export class Hud {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{width:number, height:number, scale:number, safeTop:number, safeBottom:number}} game
   * @param {HudSnapshot} snap
   */
  draw(ctx, game, snap) {
    const { width: W, height: H, scale: S, safeTop, safeBottom } = game
    const TOP = safeTop + 8
    const BOT = H - safeBottom - 8
    const fs = (n) => Math.round(n * S)

    // Lives — top left
    ctx.fillStyle = COLORS.ink
    ctx.font = `${fs(22)}px ${FONTS.sans}`
    ctx.textAlign = 'left'
    ctx.fillText(
      '♥'.repeat(snap.lives) + '♡'.repeat(Math.max(0, START_LIVES - snap.lives)),
      fs(12),
      TOP + fs(22),
    )

    // Distance — top center (with multiplier if combo active)
    ctx.font = `bold ${fs(22)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    const scoreStr =
      snap.combo > 0 ? `${Math.floor(snap.dist)}m  ×${snap.mult}` : `${Math.floor(snap.dist)}m`
    ctx.fillText(scoreStr, W / 2, TOP + fs(22))

    // Combo line — below score
    if (snap.combo > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold ${fs(15)}px ${FONTS.mono}`
      ctx.fillText(`COMBO x${snap.combo}`, W / 2, TOP + fs(44))
    }

    // Kasta — bottom left
    ctx.fillStyle = COLORS.muted
    ctx.font = `${fs(12)}px ${FONTS.mono}`
    ctx.textAlign = 'left'
    ctx.fillText(`KASTA: ${snap.kastaLabel}`, fs(12), BOT - fs(18))

    // Dash — bottom right
    ctx.textAlign = 'right'
    if (snap.dashCd > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.fillText(`DASH: ${snap.dashCd.toFixed(1)}s`, W - fs(12), BOT - fs(18))
    } else {
      ctx.fillStyle = COLORS.green
      ctx.fillText('DASH: READY', W - fs(12), BOT - fs(18))
    }

    // Controls hint — until first input
    if (snap.showControls) {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${fs(10)}px ${FONTS.mono}`
      ctx.textAlign = 'center'
      ctx.fillText('TAP=Lompat  ↓=Slide  →=Dash', W / 2, BOT - fs(2))
    }
  }
}
