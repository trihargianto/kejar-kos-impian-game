// ─── HUD ──────────────────────────────────────────────────────────────────────
// Draws the in-play HUD: lives (top-left), distance + combo (top-center),
// kasta label (bottom-left), dash cooldown (bottom-right), and the controls
// hint shown until the first input. Pure draw — owns no game state.
//
// Receives a snapshot each frame from PlayScene so it stays trivially testable.
import { COLORS, FONTS, ctaPulse } from '../../theme.js'
import { START_LIVES } from '../../constants.js'

/**
 * @typedef {Object} HudSnapshot
 * @property {number} lives
 * @property {number} dist
 * @property {number} combo
 * @property {number} mult
 * @property {number} boostTimer  Seconds of Kopi Sachet boost remaining (0 = none)
 * @property {number} sandals     Sandal Jepit ammo (0 = none)
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

    // Coins (Recehan) now live in the ground-strip badge (GroundPanel), not here.

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

    // Power-ups (GDD §VII) — top right
    ctx.textAlign = 'right'
    if (snap.boostTimer > 0) {
      ctx.fillStyle = '#6c3483' // kopi brown
      ctx.font = `bold ${fs(15)}px ${FONTS.mono}`
      ctx.fillText(`KOPI ${snap.boostTimer.toFixed(1)}s`, W - fs(12), TOP + fs(22))
    }
    if (snap.sandals > 0) {
      ctx.fillStyle = '#2980b9' // sandal blue
      ctx.font = `bold ${fs(14)}px ${FONTS.mono}`
      ctx.fillText(`SANDAL ×${snap.sandals}`, W - fs(12), TOP + fs(44))
      // Contextual throw hint (GDD §VII "tombol HUD"). Points at the THROW
      // button (bottom-right) now that throw is a button, not a swipe. Pulses so
      // it's noticed but doesn't fight the counter. Sourced from `dist` —
      // monotonic + smooth, so the pulse animates without per-scene clock state.
      ctx.globalAlpha = ctaPulse(snap.dist)
      ctx.fillStyle = COLORS.faint
      ctx.font = `${fs(9)}px ${FONTS.mono}`
      ctx.fillText('Tombol LEMPAR ↓', W - fs(12), TOP + fs(58))
      ctx.globalAlpha = 1
    }

    // Dash cooldown is shown by the DASH button itself (disabled while cooling,
    // like the THROW button when out of ammo), so there's no HUD text for it.

  }
}
