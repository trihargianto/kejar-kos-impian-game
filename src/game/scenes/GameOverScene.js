// ─── Game over scene ──────────────────────────────────────────────────────────
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { INTENT } from '../core/Input.js'
import { getRank } from '../systems/score.js'
import { submitScore } from '../systems/storage.js'

export class GameOverScene {
  constructor(game) {
    this.game = game
    this.time = 0
  }

  enter() {
    this.time = 0
    this.dist = this.game.lastDist
    this.highScore = submitScore(this.dist)
    this.isNewRecord = this.dist >= this.highScore && this.dist > 0
  }

  update(dt) {
    this.time += dt
    if (this.game.input.anyPressed(INTENT.confirm)) this.game.go('play')
  }

  draw(ctx) {
    const { width: W, height: H, scale: S } = this.game
    ctx.fillStyle = COLORS.gameoverBg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'

    ctx.fillStyle = COLORS.gameoverTitle
    ctx.font = `bold ${Math.round(44 * S)}px ${FONTS.mono}`
    ctx.fillText('GAME OVER', W / 2, H * 0.28)

    ctx.fillStyle = COLORS.gameoverDist
    ctx.font = `bold ${Math.round(28 * S)}px ${FONTS.mono}`
    ctx.fillText(`${this.dist}m`, W / 2, H * 0.42)

    ctx.fillStyle = COLORS.gameoverRank
    ctx.font = `bold ${Math.round(20 * S)}px ${FONTS.sans}`
    ctx.fillText(getRank(this.dist), W / 2, H * 0.52)

    if (this.isNewRecord) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold ${Math.round(18 * S)}px ${FONTS.mono}`
      ctx.fillText('★ REKOR BARU! ★', W / 2, H * 0.6)
    } else {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${Math.round(15 * S)}px ${FONTS.mono}`
      ctx.fillText(`Rekor: ${this.highScore}m`, W / 2, H * 0.6)
    }

    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.white
    ctx.font = `${Math.round(18 * S)}px ${FONTS.sans}`
    ctx.fillText('Tap / Spasi untuk coba lagi', W / 2, H * 0.7)
    ctx.globalAlpha = 1
  }
}
