// ─── Floating text ────────────────────────────────────────────────────────────
// Short-lived text that drifts upward and fades. Used for combos, hits, hints.
import { COLORS, FONTS } from '../theme.js'
import { setTextShadow } from '../core/utils.js'

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
    // Precompute the font string + line split once — draw() runs every frame.
    this._font = `bold ${size}px ${FONTS.mono}`
    this._lines = String(text).split('\n')
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
    setTextShadow(ctx, this.size / 20) // scale shadow with text size
    ctx.fillStyle = this.color
    ctx.font = this._font
    ctx.textAlign = 'center'
    const lines = this._lines
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], this.x, this.y + i * (this.size + 2))
    }
    ctx.restore()
  }
}
