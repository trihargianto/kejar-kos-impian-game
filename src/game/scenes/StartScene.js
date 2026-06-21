// ─── Start scene ──────────────────────────────────────────────────────────────
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js'
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { INTENT } from '../core/Input.js'
import { getHighScore } from '../systems/storage.js'

export class StartScene {
  constructor(game) {
    this.game = game
    this.time = 0
  }

  enter() {
    this.time = 0
    this.highScore = getHighScore()
  }

  update(dt) {
    this.time += dt
    if (this.game.input.anyPressed(INTENT.confirm)) this.game.go('play')
  }

  draw(ctx) {
    ctx.fillStyle = '#e8d5b0'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.game.drawFloor(ctx)

    // Title
    ctx.fillStyle = COLORS.inkSoft
    ctx.font = `bold 48px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText('KEJAR KOS', GAME_WIDTH / 2, GAME_HEIGHT * 0.22)
    ctx.fillText('IMPIAN', GAME_WIDTH / 2, GAME_HEIGHT * 0.22 + 56)

    // Subtitle
    ctx.font = `15px ${FONTS.sans}`
    ctx.fillStyle = COLORS.muted
    ctx.fillText('Tanggal tua, dompet kering,', GAME_WIDTH / 2, GAME_HEIGHT * 0.44)
    ctx.fillText('Ibu Kos gedor pintu...', GAME_WIDTH / 2, GAME_HEIGHT * 0.44 + 22)
    ctx.fillText('Kabur ke kos impian!', GAME_WIDTH / 2, GAME_HEIGHT * 0.44 + 44)

    // High score
    if (this.highScore > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold 16px ${FONTS.mono}`
      ctx.fillText(`REKOR: ${this.highScore}m`, GAME_WIDTH / 2, GAME_HEIGHT * 0.56)
    }

    // CTA
    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.accent
    ctx.font = `bold 22px ${FONTS.sans}`
    ctx.fillText('TAP / SPASI untuk mulai', GAME_WIDTH / 2, GAME_HEIGHT * 0.68)
    ctx.globalAlpha = 1

    // Controls
    ctx.font = `13px ${FONTS.mono}`
    ctx.fillStyle = COLORS.mutedSoft
    ctx.fillText('TAP = Lompat', GAME_WIDTH / 2, GAME_HEIGHT * 0.8)
    ctx.fillText('SWIPE ↓ = Slide', GAME_WIDTH / 2, GAME_HEIGHT * 0.8 + 20)
    ctx.fillText('SWIPE → = Dash', GAME_WIDTH / 2, GAME_HEIGHT * 0.8 + 40)
  }
}
