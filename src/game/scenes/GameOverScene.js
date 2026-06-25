// ─── Game over scene ──────────────────────────────────────────────────────────
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { INTENT } from '../core/Input.js'
import { getRank, formatScore } from '../systems/score.js'
import { submitScore } from '../systems/storage.js'
import { EVENTS } from '../core/EventBus.js'

export class GameOverScene {
  constructor(game) {
    this.game = game
    this.time = 0
  }

  enter() {
    this.time = 0
    this.dist = this.game.lastDist
    this.coins = this.game.lastCoins ?? 0
    this.score = this.game.lastScore ?? 0
    // The §IX kos reveal (budget + matched listing) is rendered by the React
    // KosCard overlay now; it recomputes the match from the run summary itself.
    // High-score persists SCORE (jarak × combo), not distance (GDD §IV).
    this.highScore = submitScore(this.score)
    this.isNewRecord = this.score >= this.highScore && this.score > 0
    if (this.isNewRecord) {
      this.game.events?.emit(EVENTS.GAME_OVER, { isNewRecord: true, score: this.score })
    }
  }

  update(dt) {
    this.time += dt

    // Tap / confirm → retry. The kos card is a React overlay that stops its own
    // pointer events, so a tap there opens the listing and never reaches here.
    const input = this.game.input
    if (input.anyPressed(INTENT.confirm)) {
      this.game.go('play')
    }
  }

  draw(ctx) {
    const { width: W, height: H, scale: S } = this.game
    ctx.fillStyle = COLORS.gameoverBg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'

    ctx.fillStyle = COLORS.gameoverTitle
    ctx.font = `bold ${Math.round(44 * S)}px ${FONTS.mono}`
    ctx.fillText('GAME OVER', W / 2, H * 0.15)

    // Big jarak (m) — the iconic "how far did you get" number (rank/kasta axis).
    ctx.fillStyle = COLORS.gameoverDist
    ctx.font = `bold ${Math.round(28 * S)}px ${FONTS.mono}`
    ctx.fillText(`${this.dist}m`, W / 2, H * 0.26)

    ctx.fillStyle = COLORS.gameoverRank
    ctx.font = `bold ${Math.round(20 * S)}px ${FONTS.sans}`
    ctx.fillText(getRank(this.dist), W / 2, H * 0.33)

    // Score (jarak × combo) — the persisted high-score axis. Show inline with
    // the REKOR BARU flag so the comparison the player cares about is visual.
    ctx.fillStyle = this.isNewRecord ? COLORS.gold : COLORS.white
    ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
    ctx.fillText(
      `SKOR ${formatScore(this.score)}${this.isNewRecord ? '  ★' : ''}`,
      W / 2,
      H * 0.4
    )

    // The kos reveal card (budget + matched listing) is now a React overlay —
    // KosCard.jsx — so it can be a clickable Mamikos link with a photo. It mounts
    // over the lower half of this screen; leave that space clear here.

    // Record + retry sit ABOVE the React kos card (which fills the lower area).
    if (this.isNewRecord) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
      ctx.fillText('★ REKOR BARU! ★', W / 2, H * 0.45)
    } else {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${Math.round(13 * S)}px ${FONTS.mono}`
      ctx.fillText(`Rekor: ${formatScore(this.highScore)}`, W / 2, H * 0.45)
    }

    // Retry prompt sits below the React share buttons (anchored ~47%), so push
    // it down to clear them.
    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.white
    ctx.font = `${Math.round(14 * S)}px ${FONTS.sans}`
    ctx.fillText('Tap / Spasi untuk coba lagi', W / 2, H * 0.56)
    ctx.globalAlpha = 1
  }
}
