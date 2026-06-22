// ─── HUD ──────────────────────────────────────────────────────────────────────
// Draws the in-play HUD. Pure draw — owns no game state; receives a snapshot
// each frame from PlayScene so it stays trivially testable.
//
// Information hierarchy (top section):
//   1. Distance (BIG, center) — the intuitive progress metric the whole "kejar
//      kos impian" fantasy + comedic rank are built on. This is what the player
//      reads at a glance.
//   2. Score (secondary, labeled) — jarak × combo, the high-score number. Kept
//      legible but subordinate to distance so the headline isn't an abstract
//      invented value.
//   3. Combo badge + decay bar (only while a combo is live) — surfaces the core
//      greed/decay tension that was previously invisible: the bar shrinks over
//      the 5s window and turns urgent (red) as it runs out; a near-miss refills
//      it. This is the heart of the game, so it gets real prominence.
//
// Lives sit top-left. The kasta-progress bar lives in HorizonGoal (top). Power-up
// state lives elsewhere (KOPI in GroundPanel, SANDAL on its button) so the top
// stays focused on score/distance/combo.
import { COLORS, FONTS } from '../../theme.js'
import { START_LIVES } from '../../constants.js'

/**
 * @typedef {Object} HudSnapshot
 * @property {number} lives
 * @property {number} dist
 * @property {number} score
 * @property {number} combo
 * @property {number} mult
 * @property {number} decay  Combo decay fraction (1 = fresh, 0 = about to reset)
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

    // ── Lives — top left ────────────────────────────────────────────────────
    ctx.fillStyle = COLORS.ink
    ctx.font = `${fs(22)}px ${FONTS.sans}`
    ctx.textAlign = 'left'
    ctx.fillText(
      '♥'.repeat(snap.lives) + '♡'.repeat(Math.max(0, START_LIVES - snap.lives)),
      fs(12),
      TOP + fs(22)
    )

    // ── Distance — headline, top center ─────────────────────────────────────
    ctx.font = `bold ${fs(30)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.ink
    ctx.fillText(`${Math.floor(snap.dist)}m`, W / 2, TOP + fs(28))

    // ── Score — secondary, labeled ──────────────────────────────────────────
    // Sits below the distance; the kasta-progress bar (HorizonGoal) is offset
    // to clear this line, so they no longer collide.
    ctx.font = `${fs(13)}px ${FONTS.mono}`
    ctx.fillStyle = COLORS.mutedSoft
    ctx.fillText(`SKOR ${Math.floor(snap.score)}`, W / 2, TOP + fs(46))

    // ── Combo badge + decay bar — only while live ───────────────────────────
    if (snap.combo > 0) this._drawCombo(ctx, game, snap, TOP)
  }

  // Combo badge: "COMBO x5  ×8" with a shrinking decay bar underneath. The bar
  // (and badge) tint from gold → red as the 5s window empties, so the player
  // feels the pressure to find the next near-miss before the chain dies.
  _drawCombo(ctx, game, snap, TOP) {
    const { width: W, scale: S } = game
    const fs = (n) => Math.round(n * S)
    const decay = snap.decay ?? 1

    // Urgency color: gold when fresh, red as it runs out.
    const urgent = decay < 0.35
    const badgeColor = urgent ? COLORS.accent : COLORS.gold

    // Badge text — combo count + active multiplier.
    const y = TOP + fs(72)
    ctx.textAlign = 'center'
    ctx.font = `bold ${fs(18)}px ${FONTS.mono}`
    ctx.fillStyle = badgeColor
    const label = `COMBO x${snap.combo}   ×${snap.mult}`
    ctx.fillText(label, W / 2, y)

    // Decay bar — width tracks the remaining window; centered under the badge.
    const barW = Math.round(W * 0.42)
    const barH = fs(5)
    const barX = Math.round((W - barW) / 2)
    const barY = y + fs(8)

    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.roundRect(barX, barY, barW, barH, barH / 2)
    ctx.fill()

    ctx.fillStyle = badgeColor
    ctx.beginPath()
    ctx.roundRect(barX, barY, Math.max(barH, Math.round(barW * decay)), barH, barH / 2)
    ctx.fill()
  }
}
