import { describe, it, expect } from 'vitest'
import { Obstacle } from '../src/game/entities/Obstacle.js'
import { SpawnDirector } from '../src/game/scenes/play/SpawnDirector.js'
import { CollectibleDirector } from '../src/game/scenes/play/CollectibleSystem.js'
import { getKastaDef } from '../src/game/kasta.js'

// Minimal game stub — Obstacle only reads scale/floorY/width.
const mkGame = (over = {}) => ({
  scale: 1,
  width: 390,
  floorY: 724, // GAME_HEIGHT - 120 baseline
  ...over,
})

// Run the director many times at a fixed distance and tally returned obstacle ids.
// `vacuum`/`smartlock` are injected probabilistically, so we sample.
function sampleSpawns(dist, game, iterations = 200) {
  const dir = new SpawnDirector()
  dir.reset()
  const ids = {}
  let attempts = 0
  // Force the timer to fire every iteration by stepping with a large dt.
  while (attempts < iterations) {
    dir.timer = 0
    const o = dir.update(0.0001, game, dist)
    if (o) ids[o.zone + ':' + (o.label?.split('\n')[0] ?? '?')] = (ids[o.zone + ':' + (o.label?.split('\n')[0] ?? '?')] ?? 0) + 1
    attempts++
  }
  return ids
}

describe('Obstacle.random kasta filtering', () => {
  it('tier 0 (Kipas Angin) only returns tutorial-safe obstacles', () => {
    const game = mkGame()
    // Slide obstacles are flying objects now (burung/sandal), not shelves.
    const allowed = new Set(['EMBER', 'KUCING', 'JEMURAN', 'BURUNG', 'SANDAL', 'PINTU'])
    for (let i = 0; i < 120; i++) {
      const o = Obstacle.random(game, 0)
      const labelHead = o.label.split('\n')[0]
      expect(allowed).toContain(labelHead)
    }
  })

  it('tier 1 (AC Standar) adds the floor galon + the thrown galon slide obstacle', () => {
    const game = mkGame()
    // Distinguish by verb: floor GALON (JUMP) vs flying GALON (SLIDE).
    const seen = new Set()
    for (let i = 0; i < 400; i++) {
      const o = Obstacle.random(game, 1)
      seen.add(o.zone + ':' + o.label.split('\n')[0])
    }
    expect(seen).toContain('floor:GALON') // jump obstacle
    expect(seen).toContain('ceiling:GALON') // thrown galon, slide obstacle
  })

  it('tier 2 (Singgahsini) adds monstera to the pool', () => {
    const game = mkGame()
    const seen = new Set()
    for (let i = 0; i < 300; i++) {
      const o = Obstacle.random(game, 2)
      seen.add(o.label.split('\n')[0])
    }
    expect(seen).toContain('MONSTERA')
  })

  it('tier 0 never yields galon, rak_sepatu, or monstera', () => {
    const game = mkGame()
    const forbidden = new Set(['GALON', 'RAK SEPATU', 'MONSTERA'])
    for (let i = 0; i < 200; i++) {
      const o = Obstacle.random(game, 0)
      expect(forbidden).not.toContain(o.label.split('\n')[0])
    }
  })

  it('tier 1 never yields monstera (Singgahsini-only)', () => {
    const game = mkGame()
    for (let i = 0; i < 200; i++) {
      const o = Obstacle.random(game, 1)
      expect(o.label.split('\n')[0]).not.toBe('MONSTERA')
    }
  })
})

describe('Flying slide obstacles (Area 5)', () => {
  it('no shelf-type slide obstacle remains in any tier', () => {
    const game = mkGame()
    for (let tier = 0; tier <= 3; tier++) {
      for (let i = 0; i < 200; i++) {
        const head = Obstacle.random(game, tier).label.split('\n')[0]
        expect(head).not.toBe('RAK')
        expect(head).not.toBe('RAK SEPATU')
      }
    }
  })

  it('flying objects carry speedScale > 1 (arrive faster than ground obstacles)', () => {
    const game = mkGame()
    const seen = {}
    for (let i = 0; i < 600; i++) {
      const o = Obstacle.random(game, 1)
      seen[o.label.split('\n')[0]] = o.speedScale
    }
    expect(seen['BURUNG']).toBeGreaterThan(1)
    expect(seen['SANDAL']).toBeGreaterThan(1)
    // The thrown galon (ceiling) is heavier → slower than bird/sandal but still >1.
    expect(seen['GALON']).toBeGreaterThan(1)
  })

  it('ground obstacles keep speedScale = 1 (world speed)', () => {
    const game = mkGame()
    const ember = (() => {
      for (let i = 0; i < 400; i++) {
        const o = Obstacle.random(game, 0)
        if (o.label.startsWith('EMBER')) return o
      }
    })()
    expect(ember.speedScale).toBe(1)
  })

  it('cosmetic bob never moves the collision bounds', () => {
    const game = mkGame()
    let bird
    for (let i = 0; i < 400; i++) {
      const o = Obstacle.random(game, 0)
      if (o.label.startsWith('BURUNG')) { bird = o; break }
    }
    const y0 = bird.bounds.y
    // Advance several frames; the draw-only bob accumulates but bounds.y holds.
    for (let i = 0; i < 30; i++) bird.update(1 / 60, 260)
    expect(bird.bounds.y).toBe(y0)
  })

  it('verb selection is balanced — dash shows up far more than a flat pick would', () => {
    const game = mkGame()
    const verbCount = { JUMP: 0, SLIDE: 0, DASH: 0 }
    for (let i = 0; i < 900; i++) {
      const o = Obstacle.random(game, 0)
      const verb = o.label.split('\n')[1].replace(/[()]/g, '')
      verbCount[verb]++
    }
    // With 3 zones balanced, each verb ≈ 1/3. A flat pick over 6 tier-0 defs
    // (4 jump+slide vs 1 dash) would give dash ~1/6. Assert dash ≥ 1/4 of rolls.
    expect(verbCount.DASH).toBeGreaterThan(900 / 4)
  })
})

describe('Obstacle.special', () => {
  it('builds a vacuum (floor zone, JUMP verb)', () => {
    const o = Obstacle.special('vacuum', mkGame())
    expect(o).not.toBeNull()
    expect(o.zone).toBe('floor')
    expect(o.label).toContain('JUMP')
  })

  it('builds a smart-lock (mid zone, DASH verb) — GDD §VI.3', () => {
    const o = Obstacle.special('smartlock', mkGame())
    expect(o).not.toBeNull()
    expect(o.zone).toBe('mid')
    expect(o.label).toContain('DASH')
  })

  it('returns null for unknown special ids', () => {
    expect(Obstacle.special('nope', mkGame())).toBeNull()
  })
})

describe('SpawnDirector kasta-twist injection', () => {
  it('never injects vacuum or smart-lock during Kipas Angin', () => {
    const game = mkGame()
    const ids = sampleSpawns(50, game) // well inside 0-300m
    expect(ids['floor:VACUUM'] ?? 0).toBe(0)
    expect(ids['mid:SMART-LOCK'] ?? 0).toBe(0)
  })

  it('injects vacuum during Singgahsini', () => {
    const game = mkGame()
    const ids = sampleSpawns(850, game) // well inside 700-1000m
    expect(ids['floor:VACUUM'] ?? 0).toBeGreaterThan(0)
  })

  it('injects smart-lock during Singgahsini (GDD §VI.3 "smart-lock butuh dash")', () => {
    const game = mkGame()
    const ids = sampleSpawns(850, game)
    expect(ids['mid:SMART-LOCK'] ?? 0).toBeGreaterThan(0)
  })

  it('respects the kasta def flags driving injection', () => {
    // Sanity: confirm 850m really is Singgahsini with both flags on.
    const kasta = getKastaDef(850)
    expect(kasta.mechanics.vacuum).toBe(true)
    expect(kasta.mechanics.smartLock).toBe(true)
  })
})

describe('CollectibleDirector spawning', () => {
  it('actually spawns items over time (regression: spawn() was dead code)', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    // Step ~5 seconds of gameplay. Before the fix, items[] stayed empty.
    for (let i = 0; i < 300; i++) d.spawn(1 / 60, game, [])
    expect(d.items.length).toBeGreaterThan(0)
  })

  it('produces coins over time', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    for (let i = 0; i < 600; i++) d.spawn(1 / 60, game, []) // ~10s
    const kinds = new Set(d.items.map((c) => c.kind))
    expect(kinds).toContain('coin')
  })

  it('places coins near upcoming obstacles when present (GDD §VII greed)', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    // Fake an upcoming floor-zone obstacle in the right portion of the screen.
    // Includes bounds (like a real Obstacle) so the clearance check can run.
    const obstacle = {
      x: game.width + 100,
      w: 48,
      zone: 'floor',
      get bounds() {
        return { x: this.x, y: game.floorY - 48, w: this.w, h: 48 }
      },
    }
    // Force the coin timer to fire on the first frame.
    d.coinTimer = 0
    d.spawn(0.001, game, [obstacle])
    expect(d.items.length).toBeGreaterThan(0)
    // First coin should be positioned past the obstacle (start of the arc).
    const first = d.items[0]
    expect(first.x).toBeGreaterThanOrEqual(obstacle.x + obstacle.w)
    expect(first.kind).toBe('coin')
  })

  it('falls back to right-edge placement when no obstacle is ahead', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    d.coinTimer = 0
    d.spawn(0.001, game, [])
    expect(d.items.length).toBeGreaterThan(0)
    // No obstacle → coin arc starts at the right edge (off-screen).
    expect(d.items[0].x).toBeGreaterThanOrEqual(game.width)
  })

  it('keeps coins clear of obstacles across many forced spawns (regression)', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    // A tall mid-zone door pillar + a low floor box covering much of the column.
    const door = {
      x: game.width + 60,
      w: 36,
      zone: 'mid',
      get bounds() {
        return { x: this.x, y: game.floorY - 320, w: this.w, h: 320 }
      },
    }
    const obstacles = [door]
    // Force many spawns and assert nothing lands inside an obstacle's bounds.
    for (let i = 0; i < 400; i++) {
      d.coinTimer = 0
      d.spawn(0.001, game, obstacles)
    }
    const overlaps = (c, b) => {
      const nx = Math.max(b.x, Math.min(c.x, b.x + b.w))
      const ny = Math.max(b.y, Math.min(c.y, b.y + b.h))
      const dx = c.x - nx
      const dy = c.y - ny
      return dx * dx + dy * dy < c.r * c.r
    }
    for (const c of d.items) {
      expect(overlaps(c, door.bounds)).toBe(false)
    }
  })
})
