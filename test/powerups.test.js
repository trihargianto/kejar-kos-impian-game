import { describe, it, expect } from 'vitest'
import { Collectible } from '../src/game/entities/Collectible.js'
import { CollectibleDirector } from '../src/game/scenes/play/CollectibleSystem.js'
import { ComboSystem } from '../src/game/scenes/play/ComboSystem.js'
import { Player } from '../src/game/entities/Player.js'
import { SandalProjectile } from '../src/game/entities/SandalProjectile.js'
import { PlayScene } from '../src/game/scenes/PlayScene.js'
import { KASTA_DEFS } from '../src/game/kasta.js'

const mkGame = (over = {}) => ({
  scale: 1,
  width: 390,
  floorY: 724,
  ...over,
})

describe('Collectible kinds', () => {
  it('exposes kopi + sandal kinds with distinct radii', () => {
    const game = mkGame()
    const kopi = new Collectible('kopi', game, 500)
    const sandal = new Collectible('sandal', game, 500)
    const coin = new Collectible('coin', game, 500)
    expect(kopi.kind).toBe('kopi')
    expect(sandal.kind).toBe('sandal')
    expect(kopi.r).toBeGreaterThan(coin.r)
    expect(sandal.r).toBeGreaterThan(kopi.r)
  })

  it('scales radius by game.scale', () => {
    const game = mkGame({ scale: 2 })
    const kopi = new Collectible('kopi', game, 500)
    expect(kopi.r).toBe(40) // KOPI_R=20 * scale=2
  })
})

describe('Player.applyKopi', () => {
  it('sets the boost window + the i-frame window', () => {
    const p = new Player(mkGame())
    p.reset()
    expect(p.boosting).toBe(false)
    expect(p.invincible).toBe(false)

    const { started } = p.applyKopi()
    expect(started).toBe(true)
    expect(p.boosting).toBe(true)
    expect(p.invincible).toBe(true)
  })

  it('does not report `started` if a boost is already running', () => {
    const p = new Player(mkGame())
    p.reset()
    p.applyKopi()
    const { started } = p.applyKopi()
    expect(started).toBe(false)
  })

  it('decrements boostTimer each update', () => {
    const p = new Player(mkGame())
    p.reset()
    p.applyKopi(2.0)
    p.update(0.5)
    expect(p.boostTimer).toBeCloseTo(1.5, 5)
    p.update(2.0)
    expect(p.boosting).toBe(false)
  })

  it('reset() clears boost + sandals', () => {
    const p = new Player(mkGame())
    p.reset()
    p.applyKopi()
    p.applySandalAmmo()
    p.reset()
    expect(p.boostTimer).toBe(0)
    expect(p.sandals).toBe(0)
  })
})

describe('Player sandal ammo', () => {
  it('applySandalAmmo resets ammo to SANDAL_AMMO (3), not accumulate', () => {
    const p = new Player(mkGame())
    p.reset()
    expect(p.sandals).toBe(0)
    p.applySandalAmmo()
    expect(p.sandals).toBe(3)
    // Throw one, then pickup again — should reset to 3, not 5
    p.consumeSandal()
    expect(p.sandals).toBe(2)
    p.applySandalAmmo()
    expect(p.sandals).toBe(3)
  })

  it('consumeSandal returns false + no decrement when empty', () => {
    const p = new Player(mkGame())
    p.reset()
    expect(p.consumeSandal()).toBe(false)
    expect(p.sandals).toBe(0)
  })

  it('consumeSandal decrements + returns true when ammo available', () => {
    const p = new Player(mkGame())
    p.reset()
    p.applySandalAmmo()
    expect(p.consumeSandal()).toBe(true)
    expect(p.sandals).toBe(2)
    expect(p.consumeSandal()).toBe(true)
    expect(p.consumeSandal()).toBe(true)
    expect(p.consumeSandal()).toBe(false) // now empty
  })
})

describe('ComboSystem.gainSmall', () => {
  it('advances the combo counter + resets the decay timer', () => {
    const c = new ComboSystem()
    c.reset()
    const kasta = KASTA_DEFS[0]
    const { combo } = c.gainSmall(kasta)
    expect(combo).toBe(1)
    expect(c.combo).toBe(1)
    expect(c.timer).toBe(0)
  })

  it('does NOT raise the multiplier (near-miss stays strictly better)', () => {
    const c = new ComboSystem()
    c.reset()
    const kasta = KASTA_DEFS[0]
    // Three small gains: combo=3, but mult stays at 1
    c.gainSmall(kasta)
    c.gainSmall(kasta)
    const { mult } = c.gainSmall(kasta)
    expect(c.combo).toBe(3)
    expect(mult).toBe(1)

    // One near-miss at combo=4 should bump the mult (gain uses computeMult)
    c.gain(kasta)
    expect(c.mult).toBeGreaterThan(1)
  })
})

describe('ComboSystem.decayFraction (HUD decay bar)', () => {
  it('is 0 when no combo is active', () => {
    const c = new ComboSystem()
    c.reset()
    expect(c.decayFraction).toBe(0)
  })

  it('is 1 right after a near-miss, then ramps toward 0', () => {
    const c = new ComboSystem()
    c.reset()
    c.gain(KASTA_DEFS[0])
    expect(c.decayFraction).toBeCloseTo(1, 5)
    c.update(2.5) // halfway through the 5s window
    expect(c.decayFraction).toBeCloseTo(0.5, 2)
  })

  it('a fresh near-miss refills the decay bar', () => {
    const c = new ComboSystem()
    c.reset()
    c.gain(KASTA_DEFS[0])
    c.update(4) // nearly expired
    expect(c.decayFraction).toBeLessThan(0.3)
    c.gain(KASTA_DEFS[0]) // near-miss resets the timer
    expect(c.decayFraction).toBeCloseTo(1, 5)
  })

  it('never goes negative even past the window', () => {
    const c = new ComboSystem()
    c.reset()
    c.gain(KASTA_DEFS[0])
    c.update(10)
    expect(c.decayFraction).toBeGreaterThanOrEqual(0)
  })
})

describe('CollectibleDirector power-up spawning', () => {
  it('actually spawns kopi + sandal over a long enough window', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    // Step past the longest interval (~28s base + jitter). Before this fix,
    // spawn() was dead code; this guards against future regressions.
    for (let i = 0; i < 60 * 45; i++) d.spawn(1 / 60, game, [])
    const kinds = new Set(d.items.map((c) => c.kind))
    expect(kinds).toContain('kopi')
    expect(kinds).toContain('sandal')
  })

  it('reports powerups in the update() return when picked up', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    // Spawn a kopi manually, then resolve pickup with a player bounds that
    // overlaps it.
    const kopi = new Collectible('kopi', game, game.floorY - 100)
    d.items.push(kopi)
    const playerBounds = { x: kopi.x - 5, y: kopi.y - 5, w: 10, h: 10 }
    const { powerups } = d.update(0.001, 0, playerBounds)
    expect(powerups).toContain('kopi')
  })

  it('keeps coins/items separate from powerups in the return payload', () => {
    const game = mkGame()
    const d = new CollectibleDirector()
    d.reset()
    const coin = new Collectible('coin', game, game.floorY - 100)
    d.items.push(coin)
    const playerBounds = { x: coin.x - 5, y: coin.y - 5, w: 10, h: 10 }
    const { coins, powerups } = d.update(0.001, 0, playerBounds)
    expect(coins).toBe(1)
    expect(powerups).toEqual([])
  })
})

describe('SandalProjectile', () => {
  const origin = { x: 80, y: 600, w: 52, h: 76 }

  it("launches from the player's right edge, mid-torso", () => {
    const game = mkGame()
    const s = new SandalProjectile(game, origin, null)
    expect(s.x).toBe(origin.x + origin.w)
    expect(s.y).toBe(origin.y + origin.h * 0.5)
  })

  it('returns null while still in flight (no impact yet)', () => {
    const game = mkGame()
    const target = { x: game.width + 200, w: 48 }
    const obstacles = [target]
    const s = new SandalProjectile(game, origin, target)
    const result = s.update(1 / 60, game, obstacles)
    expect(result).toBeNull()
    expect(s.dead).toBe(false)
    // Obstacle untouched until impact
    expect(obstacles).toContain(target)
  })

  it('impacts + removes the target when the sandal nose crosses target.x', () => {
    const game = mkGame()
    // Place target past origin; sandal flies at 700 px/s, so a 60px gap closes
    // in ~5 frames at 60fps. Step until impact.
    const target = { x: origin.x + origin.w + 60, w: 48 }
    const obstacles = [target]
    const s = new SandalProjectile(game, origin, target)
    let result = null
    for (let i = 0; i < 10 && !s.dead; i++) result = s.update(1 / 60, game, obstacles)
    expect(result).toEqual({ hit: true, obstacle: target })
    expect(s.dead).toBe(true)
    expect(obstacles).not.toContain(target)
  })

  it('expires off-screen without impact when its target was removed mid-flight', () => {
    const game = mkGame()
    const target = { x: game.width + 200, w: 48 }
    const obstacles = [] // target was destroyed by something else
    const s = new SandalProjectile(game, origin, target)
    // Step many frames — sandal should reach the right edge and expire.
    let result = null
    for (let i = 0; i < 600 && !s.dead; i++) result = s.update(1 / 60, game, obstacles)
    expect(s.dead).toBe(true)
    expect(result).toEqual({ hit: false })
  })

  it('clears its target reference after the target is gone (keeps flying)', () => {
    const game = mkGame()
    const target = { x: game.width + 200, w: 48 }
    const obstacles = []
    const s = new SandalProjectile(game, origin, target)
    s.update(1 / 60, game, obstacles)
    expect(s.target).toBeNull()
  })

  it('spins while flying (visible throw animation)', () => {
    const game = mkGame()
    const s = new SandalProjectile(game, origin, null)
    const spin0 = s._spin
    s.update(0.1, game, [])
    expect(s._spin).toBeGreaterThan(spin0)
  })
})

describe('PlayScene._throwSandal target-claim', () => {
  // Minimal game stub that satisfies Player + SandalProjectile constructors.
  // We bypass PlayScene.enter() (which needs floats + scene transitions) and
  // poke scene state directly to drive _throwSandal in isolation.
  const mkScene = () => {
    const game = {
      scale: 1,
      width: 390,
      floorY: 724,
      events: { emit: () => {} },
      floats: [],
      shake: { trigger: () => {} },
    }
    const scene = new PlayScene(game)
    scene.player.reset()
    scene.obs = []
    scene.sandals = []
    scene.dist = 0
    return scene
  }

  const mkObstacle = (x, w = 48) => ({
    x,
    y: 600,
    w,
    h: 48,
    bounds: { x, y: 600, w, h: 48 },
    passed: false,
    nearMissed: false,
  })

  it('regression: rapid second throw does NOT lock onto an already-claimed obstacle', () => {
    // Before the fix, both throws would target T1; sandal 1 destroyed T1 and
    // sandal 2 expired into nothing — looked like "only 2 throws worked".
    const scene = mkScene()
    const t1 = mkObstacle(scene.player.x + scene.player.w + 100)
    scene.obs.push(t1)
    scene.player.sandals = 3

    scene._throwSandal()
    expect(scene.sandals).toHaveLength(1)
    expect(scene.sandals[0].target).toBe(t1)
    expect(scene.player.sandals).toBe(2)

    // Second throw while sandal 1 is still in flight: T1 is claimed, no other
    // targets, so the second throw must refund and NOT spawn a wasted sandal.
    scene._throwSandal()
    expect(scene.sandals).toHaveLength(1) // still just the first one
    expect(scene.player.sandals).toBe(2) // refunded — ammo preserved
  })

  it('two throws at two distinct obstacles both spawn projectiles', () => {
    const scene = mkScene()
    const rightEdge = scene.player.x + scene.player.w
    const t1 = mkObstacle(rightEdge + 100)
    const t2 = mkObstacle(rightEdge + 250)
    scene.obs.push(t1, t2)
    scene.player.sandals = 3

    scene._throwSandal()
    scene._throwSandal()
    expect(scene.sandals).toHaveLength(2)
    expect(scene.sandals[0].target).toBe(t1)
    expect(scene.sandals[1].target).toBe(t2) // different obstacle
    expect(scene.player.sandals).toBe(1)
  })

  it('when the only obstacle is claimed and no other target exists, ammo is refunded', () => {
    const scene = mkScene()
    const t1 = mkObstacle(scene.player.x + scene.player.w + 100)
    scene.obs.push(t1)
    scene.player.sandals = 3

    scene._throwSandal() // claims T1
    expect(scene.player.sandals).toBe(2)

    // Spam three more throws — all should refund, ammo unchanged.
    scene._throwSandal()
    scene._throwSandal()
    scene._throwSandal()
    expect(scene.sandals).toHaveLength(1)
    expect(scene.player.sandals).toBe(2)
  })

  it('after an in-flight sandal dies, its target claim is released', () => {
    // Natural integration check: when a sandal is removed from `this.sandals`
    // (impact or expiry), its target should become targetable again on the
    // next throw. The claim set is recomputed each throw from `this.sandals`,
    // so removing the sandal is enough — no explicit un-claim needed.
    const scene = mkScene()
    const t1 = mkObstacle(scene.player.x + scene.player.w + 100)
    scene.obs.push(t1)
    scene.player.sandals = 3

    scene._throwSandal()
    expect(scene.player.sandals).toBe(2)

    // Simulate sandal 1 dying (impact or expiry) and being reaped.
    scene.sandals.length = 0

    // Now T1 is targetable again — a new throw locks onto it without refund.
    scene._throwSandal()
    expect(scene.sandals).toHaveLength(1)
    expect(scene.sandals[0].target).toBe(t1)
    expect(scene.player.sandals).toBe(1)
  })
})
