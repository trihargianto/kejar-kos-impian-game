// ─── Floating text ────────────────────────────────────────────────────────────
// Short-lived text that drifts upward and fades. Used for combos, hits, hints.
import { COLORS, FONTS } from '../theme.js'

const RISE_SPEED = 60 // px/s upward drift

export class FloatText {
  constructor(text, x, y, color = COLORS.gold, size = 20) {
    this.text = text
    this.x = x
    this.y = y
    this.color = color
    this.size = size
    this.life = 1.0
    this.maxLife = 1.0
  }

  update(dt) {
    this.life -= dt
    this.y -= RISE_SPEED * dt
  }

  dead() {
    return this.life <= 0
  }

  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife)
    ctx.fillStyle = this.color
    ctx.font = `bold ${this.size}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    this.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, this.x, this.y + i * (this.size + 2))
    })
    ctx.restore()
  }
}
