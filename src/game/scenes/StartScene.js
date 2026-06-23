// ─── Start scene ──────────────────────────────────────────────────────────────
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { getHighScore } from '../systems/storage.js'
import { EVENTS } from '../core/EventBus.js'

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
    const input = this.game.input

    // Keyboard-only shortcut straight into the game. NOTE: we exclude Tap here on
    // purpose — INTENT.confirm includes Tap, but on this menu a tap must go
    // through the button hit-test below, not blindly start the game.
    if (input.anyPressed(['Space', 'Enter', 'ArrowUp'])) {
      this.game.go('play')
      return
    }

    // The menu is tap/click-driven: Play Game / Settings / Exit.
    if (input.justPressed('Tap') && input.tapPos) {
      const hit = this._menuHit(input.tapPos.x, input.tapPos.y)
      if (hit === 'play') this.game.go('play')
      else if (hit === 'settings') {
        // Settings is a React overlay; the shell opens it. hasActiveRun=false
        // from the start screen, so no "restart" warning will apply.
        this.game.events?.emit(EVENTS.OPEN_SETTINGS, { hasActiveRun: false })
      }
    }
  }

  _menuHit(x, y) {
    for (const b of this._menuRects ?? []) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id
    }
    return null
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

    // Strict top-to-bottom stack — each block sits BELOW the previous one, so
    // nothing ever overlaps:
    //   logo → tagline → menu buttons → (gap) → mascot on the floor line
    //   floor strip: high score + controls hint
    let y = (safeTop || 0) + Math.round(H * 0.05)

    // ── Logo / wordmark ──
    const logo = this.game.assets?.has('ui:logo') ? this.game.assets.image('ui:logo') : null
    if (logo) {
      const lw = Math.round(W * 0.66)
      const lh = Math.round(lw * (logo.height / logo.width))
      ctx.drawImage(logo, Math.round((W - lw) / 2), y, lw, lh)
      y += lh + Math.round(12 * S)
    } else {
      ctx.fillStyle = COLORS.inkSoft
      ctx.font = `bold ${Math.round(40 * S)}px ${FONTS.mono}`
      ctx.fillText('KEJAR KOS', cx, y + Math.round(36 * S))
      ctx.fillText('IMPIAN', cx, y + Math.round(78 * S))
      y += Math.round(98 * S)
    }

    // ── Tagline (3 lines) ──
    ctx.fillStyle = COLORS.ink
    ctx.font = `${Math.round(14 * S)}px ${FONTS.sans}`
    const taglineLines = ['Tanggal tua, dompet kering,', 'Ibu Kos gedor pintu...', 'Kabur ke kos impian!']
    const lineH = Math.round(20 * S)
    taglineLines.forEach((t, i) => ctx.fillText(t, cx, y + i * lineH))
    y += taglineLines.length * lineH + Math.round(18 * S)

    // ── Menu buttons — directly below the tagline (no scrim; nothing behind) ──
    y = this._drawMenu(ctx, W, S, y)

    // ── Mascot — fills the remaining gap, standing on the floor line, centered.
    //    It lives strictly BELOW the menu so they can't overlap. Sized to the
    //    leftover space (menu bottom → floor line), capped so it stays tidy. ──
    const run = this.game.assets?.has('player:run') ? this.game.assets.image('player:run') : null
    if (run) {
      const gap = floorY - y
      const ph = Math.min(Math.round(H * 0.2), Math.max(0, gap - Math.round(8 * S)))
      if (ph > 0) {
        const pw = Math.round(ph * (run.width / run.height))
        ctx.drawImage(run, Math.round(cx - pw / 2), Math.round(floorY - ph), pw, ph)
      }
    }

    // ── Floor strip: high score + controls hint ──
    if (this.highScore > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold ${Math.round(15 * S)}px ${FONTS.mono}`
      ctx.fillText(`REKOR: ${this.highScore}m`, cx, floorY + Math.round(34 * S))
    }
    ctx.fillStyle = COLORS.muted
    ctx.font = `${Math.round(11 * S)}px ${FONTS.mono}`
    ctx.fillText(
      'JUMP · SLIDE · DASH · THROW di tombol kanan bawah',
      cx,
      floorY + Math.round(58 * S)
    )
  }

  // Main menu: stacked buttons starting at top `yTop`. No scrim — it sits in
  // clear space below the tagline with nothing behind it. Returns the bottom y
  // so the caller can place the mascot below. Rects cached for the tap handler.
  _drawMenu(ctx, W, S, yTop) {
    const items = [
      { id: 'play', label: '▶ Main', primary: true },
      { id: 'settings', label: '⚙ Pengaturan' },
    ]
    const bw = Math.round(W * 0.6)
    const bh = Math.round(48 * S)
    const gap = Math.round(12 * S)
    const x = Math.round((W - bw) / 2)
    let y = Math.round(yTop)

    this._menuRects = []
    for (const it of items) {
      const pulse = it.primary ? ctaPulse(this.time) : 1
      ctx.globalAlpha = pulse
      ctx.fillStyle = it.primary ? COLORS.accent : 'rgba(0,0,0,0.14)'
      ctx.beginPath()
      ctx.roundRect(x, y, bw, bh, bh / 2)
      ctx.fill()
      if (!it.primary) {
        ctx.strokeStyle = COLORS.inkSoft
        ctx.lineWidth = Math.max(1, 1.4 * S)
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, bh / 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = it.primary ? COLORS.white : COLORS.inkSoft
      ctx.font = `bold ${Math.round(18 * S)}px ${FONTS.sans}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(it.label, W / 2, y + bh / 2)
      ctx.textBaseline = 'alphabetic'
      this._menuRects.push({ id: it.id, x, y, w: bw, h: bh })
      y += bh + gap
    }
    return y // bottom of the stack (after the trailing gap)
  }
}
