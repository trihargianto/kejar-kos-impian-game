// ─── Game over scene ──────────────────────────────────────────────────────────
import { COLORS, FONTS, ctaPulse } from '../theme.js'
import { INTENT } from '../core/Input.js'
import { getRank, formatScore } from '../systems/score.js'
import { submitScore } from '../systems/storage.js'
import { EVENTS } from '../core/EventBus.js'
import {
  matchDreamKos,
  matchWithFacility,
  formatPrice,
  budgetFromCoins,
  REVEAL_CHIPS,
} from '../systems/dreamKos.js'
import { getKastaDef } from '../kasta.js'

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
    this.budget = budgetFromCoins(this.coins)
    this.tier = getKastaDef(this.dist).tier
    // §IX reveal: pick a listing within budget at the highest tier reached.
    this.activeChip = null
    this._reroll()
    // High-score persists SCORE (jarak × combo), not distance (GDD §IV).
    this.highScore = submitScore(this.score)
    this.isNewRecord = this.score >= this.highScore && this.score > 0
    if (this.isNewRecord) {
      this.game.events?.emit(EVENTS.GAME_OVER, { isNewRecord: true, score: this.score })
    }
  }

  // Re-run the matcher for either the default reveal (no chip) or a chip filter.
  _reroll(chipId = null) {
    this.activeChip = chipId
    this.dreamKos =
      chipId === null
        ? matchDreamKos({ budget: this.budget, tier: this.tier })
        : matchWithFacility({ budget: this.budget, tier: this.tier, facilityId: chipId })
  }

  update(dt) {
    this.time += dt

    // Chip keyboard fallback (desktop) — Digit1..N select a chip.
    const input = this.game.input
    for (let i = 0; i < REVEAL_CHIPS.length; i++) {
      if (input.justPressed(`Digit${i + 1}`)) {
        this._reroll(REVEAL_CHIPS[i].id)
        return
      }
    }

    // Tap: if it lands on a chip, re-roll and DO NOT also advance to retry.
    // Otherwise it falls through to confirm → play scene.
    if (input.anyPressed(INTENT.confirm)) {
      const pos = input.tapPos
      if (pos && this._chipAt(pos.x, pos.y)) {
        const hit = this._chipAt(pos.x, pos.y)
        this._reroll(hit.id)
        this.game.events?.emit(EVENTS.CHIP_TAP, { id: hit.id })
        return
      }
      this.game.go('play')
    }
  }

  draw(ctx) {
    const { width: W, height: H, scale: S } = this.game
    ctx.fillStyle = COLORS.gameoverBg
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'

    ctx.fillStyle = COLORS.gameoverTitle
    ctx.font = `bold ${Math.round(44 * S)}px ${FONTS.mono}`
    ctx.fillText('GAME OVER', W / 2, H * 0.15)

    // Big jarak (m) — the iconic "how far did you get" number (rank/kasta axis).
    ctx.fillStyle = COLORS.gameoverDist
    ctx.font = `bold ${Math.round(28 * S)}px ${FONTS.mono}`
    ctx.fillText(`${this.dist}m`, W / 2, H * 0.26)

    ctx.fillStyle = COLORS.gameoverRank
    ctx.font = `bold ${Math.round(20 * S)}px ${FONTS.sans}`
    ctx.fillText(getRank(this.dist), W / 2, H * 0.33)

    // Score (jarak × combo) — the persisted high-score axis. Show inline with
    // the REKOR BARU flag so the comparison the player cares about is visual.
    ctx.fillStyle = this.isNewRecord ? COLORS.gold : COLORS.white
    ctx.font = `bold ${Math.round(16 * S)}px ${FONTS.mono}`
    ctx.fillText(
      `SKOR ${formatScore(this.score)}${this.isNewRecord ? '  ★' : ''}`,
      W / 2,
      H * 0.4
    )

    this._drawBudget(ctx, W, H, S)
    this._drawDreamReveal(ctx, W, H, S)
    this._drawChips(ctx, W, H, S)

    if (this.isNewRecord) {
      ctx.fillStyle = COLORS.gold
      ctx.font = `bold ${Math.round(18 * S)}px ${FONTS.mono}`
      ctx.fillText('★ REKOR BARU! ★', W / 2, H * 0.84)
    } else {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${Math.round(15 * S)}px ${FONTS.mono}`
      ctx.fillText(`Rekor: ${formatScore(this.highScore)}`, W / 2, H * 0.84)
    }

    ctx.globalAlpha = ctaPulse(this.time)
    ctx.fillStyle = COLORS.white
    ctx.font = `${Math.round(18 * S)}px ${FONTS.sans}`
    ctx.fillText('Tap / Spasi untuk coba lagi', W / 2, H * 0.91)
    ctx.globalAlpha = 1
  }

  // Budget line — coins → rupiah band the reveal shops within.
  _drawBudget(ctx, W, H, S) {
    ctx.fillStyle = COLORS.faint
    ctx.font = `${Math.round(12 * S)}px ${FONTS.mono}`
    ctx.fillText(`Budget: ${formatPrice(this.budget).replace('/bulan', '')}`, W / 2, H * 0.45)
  }

  // §IX Kos Impian reveal — a card naming the matched listing + price.
  _drawDreamReveal(ctx, W, H, S) {
    const k = this.dreamKos
    const cardY = H * 0.5
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

  // Tappable facility chips. Layout is computed once per draw and cached so the
  // tap handler in update() can hit-test the same rects.
  _drawChips(ctx, W, H, S) {
    const chipH = Math.round(26 * S)
    const gap = Math.round(8 * S)
    const padX = Math.round(12 * S)
    ctx.font = `bold ${Math.round(11 * S)}px ${FONTS.mono}`
    const widths = REVEAL_CHIPS.map((c) => ctx.measureText(c.label).width + padX * 2)
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (REVEAL_CHIPS.length - 1)
    let cx = (W - totalW) / 2
    const cy = H * 0.68

    this._chipRects = []
    for (let i = 0; i < REVEAL_CHIPS.length; i++) {
      const c = REVEAL_CHIPS[i]
      const w = widths[i]
      const selected = this.activeChip === c.id
      ctx.fillStyle = selected ? 'rgba(241,196,15,0.85)' : 'rgba(255,255,255,0.10)'
      ctx.beginPath()
      ctx.roundRect(cx, cy, w, chipH, chipH / 2)
      ctx.fill()
      ctx.strokeStyle = selected ? COLORS.gold : 'rgba(255,255,255,0.35)'
      ctx.lineWidth = Math.max(1, 1.2 * S)
      ctx.beginPath()
      ctx.roundRect(cx, cy, w, chipH, chipH / 2)
      ctx.stroke()
      ctx.fillStyle = selected ? COLORS.ink : COLORS.white
      ctx.textAlign = 'center'
      ctx.fillText(c.label, cx + w / 2, cy + Math.round(17 * S))
      // Cache the rect in canvas-CSS-px space (matches tapPos from Input).
      this._chipRects.push({ id: c.id, x: cx, y: cy, w, h: chipH })
      cx += w + gap
    }

    ctx.fillStyle = COLORS.faint
    ctx.font = `${Math.round(10 * S)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText('ketuk untuk ganti · tombol 1-' + REVEAL_CHIPS.length, W / 2, cy + chipH + Math.round(14 * S))
  }

  // Hit-test pointer coords against the last-drawn chip rects.
  _chipAt(x, y) {
    if (!this._chipRects) return null
    for (const r of this._chipRects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return REVEAL_CHIPS.find((c) => c.id === r.id)
      }
    }
    return null
  }
}
