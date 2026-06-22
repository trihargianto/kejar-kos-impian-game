// ─── HUD ──────────────────────────────────────────────────────────────────────
// Draws the in-play HUD: lives (top-left), score + distance + combo (top-center).
// Pure draw — owns no game state.
//
// Score (jarak × combo multiplier) is the headline number that persists as the
// high-score; distance (m) is shown smaller below it for rank/kasta context.
//
// Power-up indicators (KOPI boost) live in the GroundPanel, not here. Sandal
// ammo is shown on the THROW button itself (GameCanvas.jsx).
//
// Receives a snapshot each frame from PlayScene so it stays trivially testable.
import { COLORS, FONTS } from '../../theme.js'
import { START_LIVES } from '../../constants.js'

/**
 * @typedef {Object} HudSnapshot
 * @property {number} lives
 * @property {number} dist
 * @property {number} score
 * @property {number} combo
 * @property {number} mult
 */

export class Hud {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{width:number, height:number, scale:number, safeTop:number, safeBottom:number}} game
   * @param {HudSnapshot} snap
   */
  draw(ctx, game, snap) {
    const { width: W, scale: S, safeTop } = game
    const TOP = safeTop + 8
    const fs = (n) => Math.round(n * S)

    // Lives — top left
    ctx.fillStyle = COLORS.ink
    ctx.font = `${fs(22)}px ${FONTS.sans}`
    ctx.textAlign = 'left'
    ctx.fillText(
      '♥'.repeat(snap.lives) + '♡'.repeat(Math.max(0, START_LIVES - snap.lives)),
      fs(12),
      TOP + fs(22)
    )

    // Score — top center, primary line (the number that persists as high-score).
    // Multiplier suffix appended when a combo is active so the player sees the
    // payoff for aggression.
    ctx.font = `bold ${fs(24)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    const scoreStr =
      snap.combo > 0
        ? `${Math.floor(snap.score)}  ×${snap.mult}`
        : `${Math.floor(snap.score)}`
    ctx.fillStyle = COLORS.ink
    ctx.fillText(scoreStr, W / 2, TOP + fs(26))

    // Distance + combo count — single secondary line, well below the score so
    // the two lines breathe instead of stacking into each other.
    ctx.font = `${fs(13)}px ${FONTS.mono}`
    ctx.fillStyle = COLORS.faint
    const distStr = snap.combo > 0 ? `${Math.floor(snap.dist)}m  ·  x${snap.combo}` : `${Math.floor(snap.dist)}m`
    ctx.fillText(distStr, W / 2, TOP + fs(50))
  }
}
