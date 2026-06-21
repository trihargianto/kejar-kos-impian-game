// ─── Start scene ──────────────────────────────────────────────────────────────
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
    const { width: W, height: H, scale: S } = this.game
    ctx.fillStyle = '#e8d5b0'
    ctx.fillRect(0, 0, W, H)
    this.game.drawFloor(ctx)

    // Title
    ctx.fillStyle = COLORS.inkSoft
    ctx.font = `bold ${Math.round(48 * S)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText('KEJAR KOS', W / 2, H * 0.22)
    ctx.fillText('IMPIAN', W / 2, H * 0.22 + Math.round(56 * S))

    // Subtitle
    ctx.font = `${Math.round(15 * S)}px ${FONTS.sans}`
    ctx.fillStyle = COLORS.muted
    ctx.fillText('Tanggal tua, dompet kering,', W / 2, H * 0.44)
    ctx.fillText('Ibu Kos gedor pintu...', W / 2, H * 0.44 + Math.round(22 * S))
    ctx.fillText('Kabur ke kos impian!', W / 2, H * 0.44 + Math.round(44 * S))

    // High score
    if (this.highScore > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
      ctx.fillText(`REKOR: ${this.highScore}m`, W / 2, H * 0.56)
    }

    // CTA
    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.accent
    ctx.font = `bold ${Math.round(22 * S)}px ${FONTS.sans}`
    ctx.fillText('TAP / SPASI untuk mulai', W / 2, H * 0.68)
    ctx.globalAlpha = 1

    // Controls — all actions are on-screen buttons during play.
    ctx.font = `${Math.round(13 * S)}px ${FONTS.mono}`
    ctx.fillStyle = COLORS.mutedSoft
    ctx.fillText('Tombol kanan bawah:', W / 2, H * 0.8)
    ctx.fillText('JUMP · SLIDE · DASH · THROW', W / 2, H * 0.8 + Math.round(20 * S))
    ctx.fillText('Tap JUMP lagi di udara = double jump', W / 2, H * 0.8 + Math.round(40 * S))
  }
}
