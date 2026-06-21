// ─── Game over scene ──────────────────────────────────────────────────────────
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js'
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
    ctx.fillStyle = COLORS.gameoverBg
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.textAlign = 'center'

    ctx.fillStyle = COLORS.gameoverTitle
    ctx.font = `bold 44px ${FONTS.mono}`
    ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT * 0.28)

    ctx.fillStyle = COLORS.gameoverDist
    ctx.font = `bold 28px ${FONTS.mono}`
    ctx.fillText(`${this.dist}m`, GAME_WIDTH / 2, GAME_HEIGHT * 0.42)

    ctx.fillStyle = COLORS.gameoverRank
    ctx.font = `bold 20px ${FONTS.sans}`
    ctx.fillText(getRank(this.dist), GAME_WIDTH / 2, GAME_HEIGHT * 0.52)

    // High score / new record
    if (this.isNewRecord) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold 18px ${FONTS.mono}`
      ctx.fillText('★ REKOR BARU! ★', GAME_WIDTH / 2, GAME_HEIGHT * 0.6)
    } else {
      ctx.fillStyle = COLORS.faint
      ctx.font = `15px ${FONTS.mono}`
      ctx.fillText(`Rekor: ${this.highScore}m`, GAME_WIDTH / 2, GAME_HEIGHT * 0.6)
    }

    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.white
    ctx.font = `18px ${FONTS.sans}`
    ctx.fillText('Tap / Spasi untuk coba lagi', GAME_WIDTH / 2, GAME_HEIGHT * 0.7)
    ctx.globalAlpha = 1
  }
}
