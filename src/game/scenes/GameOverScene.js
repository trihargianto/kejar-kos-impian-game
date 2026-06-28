// ─── Game over scene ──────────────────────────────────────────────────────────
import { COLORS, FONTS } from '../theme.js'
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
  }

  draw(ctx) {
    const { width: W, height: H, scale: S } = this.game
    ctx.fillStyle = COLORS.gameoverBg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'

    // Four stacked lines in the top zone; the rest is React overlays.
    //   top    → GAME OVER (smaller than before)
    //   rank   → rank title ("🥴 Pejuang Kos Pemula")
    //   stats  → Skor · Rekor
    //   jarak  → Jarak (own line below)
    const title_y = 0.07
    const rank_y  = 0.115
    const stats_y = 0.15
    const jarak_y = 0.185

    // Top: GAME OVER, smaller.
    ctx.fillStyle = COLORS.gameoverTitle
    ctx.font = `bold ${Math.round(30 * S)}px ${FONTS.mono}`
    ctx.fillText('GAME OVER', W / 2, H * title_y)

    // Middle: rank title. Gold on a new record so the achievement reads.
    ctx.fillStyle = this.isNewRecord ? COLORS.gold : COLORS.gameoverRank
    ctx.font = `bold ${Math.round(22 * S)}px ${FONTS.sans}`
    ctx.fillText(getRank(this.dist), W / 2, H * rank_y)

    // Skor · Rekor on one line. Append ★ to the record on a new best so the
    // player sees the comparison without a separate REKOR BARU line.
    ctx.fillStyle = COLORS.white
    ctx.font = `bold ${Math.round(14 * S)}px ${FONTS.mono}`
    ctx.fillText(
      `Skor: ${formatScore(this.score)}  ·  ` +
        `Rekor: ${formatScore(this.highScore)}${this.isNewRecord ? ' ★' : ''}`,
      W / 2,
      H * stats_y
    )

    // Jarak on its own line below, dimmer so Skor/Rekor stay primary.
    ctx.fillStyle = COLORS.faint
    ctx.font = `bold ${Math.round(13 * S)}px ${FONTS.mono}`
    ctx.fillText(`Jarak: ${this.dist}m`, W / 2, H * jarak_y)

    // Below this: share button, retry/exit, and the kos reveal card are all
    // React overlays (GameCanvas.jsx / KosCard.jsx) — leave that space clear.
  }
}
