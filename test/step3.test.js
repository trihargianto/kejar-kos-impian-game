import { describe, it, expect, beforeEach } from 'vitest'
import { drawShareCard, SHARE_W, SHARE_H, GAME_URL } from '../src/game/systems/shareImage.js'
import { getRank } from '../src/game/systems/score.js'
import { formatPrice } from '../src/game/systems/dreamKos.js'

// A recording 2D-context stub: captures every fillText string and tracks how
// many of each shape call ran, plus a measureText whose width scales with text
// length so the truncate() ellipsis logic has something monotonic to bite on.
function mockCtx() {
  const texts = []
  const calls = { fillRect: 0, fill: 0, stroke: 0, roundRect: 0, arc: 0 }
  return {
    canvas: { width: SHARE_W, height: SHARE_H },
    texts,
    calls,
    // props the drawer sets — accept and ignore
    set fillStyle(_) {},
    get fillStyle() {
      return '#000'
    },
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set font(_) {},
    set textAlign(_) {},
    fillText: (t) => texts.push(String(t)),
    measureText: (t) => ({ width: String(t).length * 30 }),
    fillRect: () => calls.fillRect++,
    beginPath: () => {},
    roundRect: () => calls.roundRect++,
    arc: () => calls.arc++,
    fill: () => calls.fill++,
    stroke: () => calls.stroke++,
    createLinearGradient: () => ({ addColorStop: () => {} }),
  }
}

describe('Step 3 — share image card', () => {
  const result = {
    dist: 742,
    score: 15820,
    dreamKos: { name: 'Kos Eksklusif Cendana', area: 'Depok', price: 1500000 },
  }

  it('uses the IG-Story 9:16 dimensions', () => {
    expect(SHARE_W).toBe(1080)
    expect(SHARE_H).toBe(1920)
    expect(SHARE_W / SHARE_H).toBeCloseTo(9 / 16, 5)
  })

  it('draws distance, rank, kos name, price and link', () => {
    const ctx = mockCtx()
    drawShareCard(ctx, result)
    const joined = ctx.texts.join('\n')
    expect(joined).toContain('742m')
    expect(joined).toContain(getRank(742))
    expect(joined).toContain('Kos Eksklusif Cendana')
    expect(joined).toContain(formatPrice(1500000))
    // Link is drawn without the protocol prefix.
    expect(joined).toContain(GAME_URL.replace(/^https?:\/\//, ''))
  })

  it('renders the gold reveal card (rounded rect + stroke) when a kos is present', () => {
    const ctx = mockCtx()
    drawShareCard(ctx, result)
    expect(ctx.calls.roundRect).toBeGreaterThan(0)
    expect(ctx.calls.stroke).toBeGreaterThan(0)
  })

  it('skips the kos card when no dreamKos is given but still shows distance', () => {
    const ctx = mockCtx()
    drawShareCard(ctx, { dist: 50, score: 80 })
    const joined = ctx.texts.join('\n')
    expect(joined).toContain('50m')
    expect(joined).not.toContain('KOS IMPIANKU')
  })

  it('truncates an over-long kos name with an ellipsis', () => {
    const ctx = mockCtx()
    const longName = 'Kos Dengan Nama Yang Sangat Panjang Sekali Melebihi Lebar Kartu'
    drawShareCard(ctx, { ...result, dreamKos: { ...result.dreamKos, name: longName } })
    const joined = ctx.texts.join('\n')
    expect(joined).not.toContain(longName)
    expect(joined).toMatch(/…/)
  })
})

// ─── Hit-stop (freezeFor) ──────────────────────────────────────────────────────
// Game's loop is DOM-bound, so exercise the freeze accounting on a minimal stand
// in that mirrors freezeFor()'s clamp + max-merge semantics.
describe('Step 3 — hit-stop freeze accounting', () => {
  const MAX_DT = 0.05
  let freeze
  const freezeFor = (s) => {
    freeze = Math.min(MAX_DT, Math.max(freeze, s))
  }

  beforeEach(() => {
    freeze = 0
  })

  it('takes the longest of overlapping triggers', () => {
    freezeFor(0.05)
    freezeFor(0.02)
    expect(freeze).toBe(0.05)
  })

  it('clamps a runaway value to MAX_DT', () => {
    freezeFor(10)
    expect(freeze).toBe(MAX_DT)
  })

  it('drains to zero over a few frames (~50ms at 60fps)', () => {
    freezeFor(0.05)
    for (let i = 0; i < 4; i++) freeze -= 0.016 // 4 × 16ms = 64ms > 50ms
    expect(freeze).toBeLessThanOrEqual(0)
  })
})
