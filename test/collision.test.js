import { describe, it, expect } from 'vitest'
import { testObstacle } from '../src/game/scenes/play/CollisionSystem.js'

// Minimal stubs — testObstacle only reads these fields.
const mkPlayer = (over = {}) => ({
  x: 80,
  y: 0,
  w: 52,
  h: 76,
  bounds: { x: 80, y: 0, w: 52, h: 76 },
  invincible: false,
  snappingBack: false,
  dashing: false,
  ...over,
})

const mkObstacle = (over = {}) => ({
  x: 200,
  y: 0,
  w: 32,
  h: 300,
  bounds: { x: 200, y: 0, w: 32, h: 300 },
  zone: 'mid',
  passed: false,
  nearMissed: false,
  ...over,
})

describe('CollisionSystem.testObstacle', () => {
  it('returns null when nowhere near', () => {
    expect(testObstacle(mkObstacle({ x: 500 }), mkPlayer(), 22)).toBeNull()
  })

  it("fires 'near-miss' inside the mepet window", () => {
    const p = mkPlayer({ x: 80, w: 52, bounds: { x: 80, y: 0, w: 52, h: 76 } })
    // gap = obstacle.x - (player.x + player.w) = 140 - 132 = 8 → within 22px
    const o = mkObstacle({ x: 140 })
    o.bounds = { x: 140, y: 0, w: 32, h: 300 }
    const r = testObstacle(o, p, 22)
    expect(r).toBe('near-miss')
  })

  it("returns 'collision' on plain overlap", () => {
    const o = mkObstacle({ x: 90, zone: 'floor' })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    expect(testObstacle(o, mkPlayer(), 22)).toBe('collision')
  })

  it("returns 'dash-break' when dashing through a mid obstacle", () => {
    const o = mkObstacle({ x: 90, zone: 'mid' })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    const p = mkPlayer({ dashing: true })
    expect(testObstacle(o, p, 22)).toBe('dash-break')
  })

  it("returns 'collision' when dashing into a NON-mid obstacle", () => {
    // Dash only breaks doors; floor/ceiling obstacles still damage.
    const o = mkObstacle({ x: 90, zone: 'floor' })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    const p = mkPlayer({ dashing: true })
    expect(testObstacle(o, p, 22)).toBe('collision')
  })

  it('returns null during snap-back (i-frames)', () => {
    const o = mkObstacle({ x: 90, zone: 'floor' })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    const p = mkPlayer({ snappingBack: true })
    expect(testObstacle(o, p, 22)).toBeNull()
  })

  it('returns null during invincibility', () => {
    const o = mkObstacle({ x: 90, zone: 'floor' })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    const p = mkPlayer({ invincible: true })
    expect(testObstacle(o, p, 22)).toBeNull()
  })

  it('does not re-fire near-miss once flagged', () => {
    const o = mkObstacle({ nearMissed: true, x: 90 })
    o.bounds = { x: 90, y: 0, w: 32, h: 300 }
    // Already near-missed; even overlapping should not return 'near-miss'.
    expect(testObstacle(o, mkPlayer(), 22)).not.toBe('near-miss')
  })
})
