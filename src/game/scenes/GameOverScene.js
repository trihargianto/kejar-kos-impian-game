// ─── Game over scene ──────────────────────────────────────────────────────────
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { INTENT } from '../core/Input.js'
import { getRank } from '../systems/score.js'
import { submitScore } from '../systems/storage.js'
import { matchDreamKos, formatPrice } from '../systems/dreamKos.js'

export class GameOverScene {
  constructor(game) {
    this.game = game
    this.time = 0
  }

  enter() {
    this.time = 0
    this.dist = this.game.lastDist
    this.coins = this.game.lastCoins ?? 0
    // §IX reveal: match the run's dream-kos profile to a listing.
    this.dreamKos = matchDreamKos(this.game.lastDreamProfile ?? [])
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
    ctx.fillText(getRank(this.dist), W / 2, H * 0.5)

    this._drawDreamReveal(ctx, W, H, S)

    if (this.isNewRecord) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold ${Math.round(18 * S)}px ${FONTS.mono}`
      ctx.fillText('★ REKOR BARU! ★', W / 2, H * 0.78)
    } else {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${Math.round(15 * S)}px ${FONTS.mono}`
      ctx.fillText(`Rekor: ${this.highScore}m`, W / 2, H * 0.78)
    }

    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.white
    ctx.font = `${Math.round(18 * S)}px ${FONTS.sans}`
    ctx.fillText('Tap / Spasi untuk coba lagi', W / 2, H * 0.86)
    ctx.globalAlpha = 1
  }

  // §IX Kos Impian reveal — a card naming the matched listing + price.
  _drawDreamReveal(ctx, W, H, S) {
    const k = this.dreamKos
    const cardY = H * 0.56
    const cardW = W * 0.82
    const cardH = H * 0.16
    const cardX = (W - cardW) / 2

    ctx.fillStyle = 'rgba(241,196,15,0.12)'
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 12 * S)
    ctx.fill()
    ctx.strokeStyle = COLORS.gold
    ctx.lineWidth = Math.max(1, 1.5 * S)
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 12 * S)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.fillStyle = COLORS.faint
    ctx.font = `${Math.round(12 * S)}px ${FONTS.mono}`
    ctx.fillText('🏠 KOS IMPIANMU', W / 2, cardY + 22 * S)

    ctx.fillStyle = COLORS.white
    ctx.font = `bold ${Math.round(17 * S)}px ${FONTS.sans}`
    ctx.fillText(k.name, W / 2, cardY + 44 * S)

    ctx.fillStyle = COLORS.gold
    ctx.font = `bold ${Math.round(15 * S)}px ${FONTS.mono}`
    ctx.fillText(formatPrice(k.price), W / 2, cardY + 66 * S)

    ctx.fillStyle = COLORS.faint
    ctx.font = `${Math.round(11 * S)}px ${FONTS.mono}`
    ctx.fillText(`${k.area} · ada di Mamikos`, W / 2, cardY + 84 * S)
  }
}
