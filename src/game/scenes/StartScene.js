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
    const { width: W, height: H, scale: S, floorY, safeTop } = this.game
    // Warm vertical gradient instead of a flat pale wash — gives the text more
    // to sit against and reads less washed-out.
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#efdcb6')
    bg.addColorStop(1, '#cdab78')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)
    this.game.drawFloor(ctx)

    ctx.textAlign = 'center'
    const cx = W / 2

    // Vertical flow: walk a cursor `y` down the screen with consistent gaps, so
    // the stack never collides regardless of the logo's height. Top group
    // (logo → tagline) sits in the upper area; the player mascot stands on the
    // floor; the CTA + controls anchor to the bottom.
    let y = (safeTop || 0) + Math.round(H * 0.06)

    // ── Logo / wordmark ──
    const logo = this.game.assets?.has('ui:logo') ? this.game.assets.image('ui:logo') : null
    if (logo) {
      const lw = Math.round(W * 0.78)
      const lh = Math.round(lw * (logo.height / logo.width))
      ctx.drawImage(logo, Math.round((W - lw) / 2), y, lw, lh)
      y += lh + Math.round(18 * S)
    } else {
      ctx.fillStyle = COLORS.inkSoft
      ctx.font = `bold ${Math.round(46 * S)}px ${FONTS.mono}`
      ctx.fillText('KEJAR KOS', cx, y + Math.round(40 * S))
      ctx.fillText('IMPIAN', cx, y + Math.round(92 * S))
      y += Math.round(120 * S)
    }

    // ── Tagline (3 lines) ──
    ctx.fillStyle = COLORS.ink
    ctx.font = `${Math.round(15 * S)}px ${FONTS.sans}`
    const taglineLines = ['Tanggal tua, dompet kering,', 'Ibu Kos gedor pintu...', 'Kabur ke kos impian!']
    const lineH = Math.round(22 * S)
    taglineLines.forEach((t, i) => ctx.fillText(t, cx, y + i * lineH))
    y += taglineLines.length * lineH

    // ── High score (optional) ──
    if (this.highScore > 0) {
      y += Math.round(18 * S)
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
      ctx.fillText(`REKOR: ${this.highScore}m`, cx, y)
    }

    // ── Player mascot — standing on the floor line, fills the empty mid area ──
    const run = this.game.assets?.has('player:run') ? this.game.assets.image('player:run') : null
    if (run) {
      const ph = Math.round(H * 0.16)
      const pw = Math.round(ph * (run.width / run.height))
      ctx.drawImage(run, Math.round(cx - pw / 2), Math.round(floorY - ph), pw, ph)
    }

    // ── CTA — pulses, anchored above the controls block near the bottom ──
    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.accent
    ctx.font = `bold ${Math.round(22 * S)}px ${FONTS.sans}`
    ctx.fillText('TAP / SPASI untuk mulai', cx, floorY + Math.round(54 * S))
    ctx.globalAlpha = 1

    // ── Controls hint — verb pills mirroring the in-play button cluster ──
    this._drawControlPills(ctx, cx, floorY + Math.round(80 * S), S)

    ctx.fillStyle = COLORS.muted
    ctx.font = `${Math.round(11 * S)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText(
      'Tombol kanan bawah · JUMP lagi di udara = double jump',
      cx,
      floorY + Math.round(108 * S)
    )
  }

  // A neat row of rounded "key" pills for the four verbs, centered. Echoes the
  // on-screen button cluster so players map the labels before the run starts.
  _drawControlPills(ctx, cx, cy, S) {
    const labels = ['JUMP', 'SLIDE', 'DASH', 'THROW']
    const fontPx = Math.round(12 * S)
    const padX = Math.round(11 * S)
    const gap = Math.round(7 * S)
    const h = Math.round(24 * S)

    ctx.font = `bold ${fontPx}px ${FONTS.mono}`
    const widths = labels.map((l) => Math.round(ctx.measureText(l).width) + padX * 2)
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1)
    let x = Math.round(cx - totalW / 2)
    const y = Math.round(cy - h / 2)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < labels.length; i++) {
      const w = widths[i]
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, h / 2)
      ctx.fill()
      ctx.strokeStyle = COLORS.inkSoft
      ctx.lineWidth = Math.max(1, Math.round(1.4 * S))
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, h / 2)
      ctx.stroke()
      ctx.fillStyle = COLORS.inkSoft
      ctx.fillText(labels[i], x + w / 2, y + h / 2 + Math.round(S))
      x += w + gap
    }
    ctx.textBaseline = 'alphabetic'
  }
}
