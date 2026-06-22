import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getRank,
  getKasta,
  comboMultiplier,
  nearMissText,
} from '../src/game/systems/score.js'
import {
  getKastaDef,
  KASTA_DEFS,
  getNextKastaThreshold,
  getNextKastaDef,
} from '../src/game/kasta.js'
import { PlayScene } from '../src/game/scenes/PlayScene.js'
import { getHighScore, submitScore } from '../src/game/systems/storage.js'

describe('score / progression', () => {
  describe('getRank', () => {
    it('returns the lowest rank at 0m', () => {
      expect(getRank(0)).toMatch(/Buronan Kelas Teri/)
    })
    it('returns the lowest rank up to 99m', () => {
      expect(getRank(99)).toMatch(/Buronan Kelas Teri/)
    })
    it('promotes to "Suhu Tanggal Tua" at 100m', () => {
      expect(getRank(100)).toMatch(/Suhu Tanggal Tua/)
    })
    it('promotes to "Buronan Kelas Kakap" at 500m', () => {
      expect(getRank(500)).toMatch(/Buronan Kelas Kakap/)
    })
    it('promotes to "Legenda" at 1000m', () => {
      expect(getRank(1000)).toMatch(/Legenda/)
    })
    it('stays at Legenda well past 1000m', () => {
      expect(getRank(99999)).toMatch(/Legenda/)
    })
  })

  describe('getKasta', () => {
    it('starts at KIPAS ANGIN', () => {
      expect(getKasta(0)).toBe('KIPAS ANGIN')
    })
    it('switches to AC STANDAR at 300m', () => {
      expect(getKasta(299)).toBe('KIPAS ANGIN')
      expect(getKasta(300)).toBe('AC STANDAR')
    })
    it('switches to SINGGAHSINI at 700m', () => {
      expect(getKasta(699)).toBe('AC STANDAR')
      expect(getKasta(700)).toBe('SINGGAHSINI')
    })
    it('switches to KOS IMPIAN at 1000m', () => {
      expect(getKasta(999)).toBe('SINGGAHSINI')
      expect(getKasta(1000)).toBe('KOS IMPIAN')
    })
  })

  describe('getKastaDef', () => {
    it('returns the full record (data-driven mechanic flags)', () => {
      const def = getKastaDef(750)
      expect(def.id).toBe('singgahsini')
      expect(def.mechanics.vacuum).toBe(true)
      expect(def.mechanics.slippery).toBe(false)
    })
    it('releases combo cap in Mode Kos Impian', () => {
      const def = getKastaDef(1500)
      expect(def.comboMultiplierCap).toBe(Infinity)
    })
    it('AC STANDAR is slippery', () => {
      expect(getKastaDef(500).mechanics.slippery).toBe(true)
    })
    it('KIPAS ANGIN has no twist mechanics', () => {
      const m = getKastaDef(100).mechanics
      expect(Object.values(m).every((v) => v === false)).toBe(true)
    })
  })

  describe('getNextKastaThreshold', () => {
    it('returns next tier early in the game', () => {
      expect(getNextKastaThreshold(0)).toBe(300)
    })
    it('returns null past the final tier', () => {
      expect(getNextKastaThreshold(1500)).toBeNull()
    })
  })

  describe('getNextKastaDef', () => {
    it('returns the next tier definition (the one you fill toward)', () => {
      const next = getNextKastaDef(0) // in Kipas Angin → next is AC Standar
      expect(next.label).toBe('AC STANDAR')
      expect(next.fromMeters).toBe(300)
    })
    it('returns the upcoming def mid-tier', () => {
      expect(getNextKastaDef(800).label).toBe('KOS IMPIAN') // in Singgahsini
    })
    it('returns null on the final tier (no next)', () => {
      expect(getNextKastaDef(1500)).toBeNull()
    })
  })

  describe('comboMultiplier', () => {
    it('starts at 1', () => {
      expect(comboMultiplier(0)).toBe(1)
    })
    it('doubles every 2 near-misses', () => {
      expect(comboMultiplier(2)).toBe(2)
      expect(comboMultiplier(4)).toBe(4)
      expect(comboMultiplier(6)).toBe(8)
    })
    it('respects the cap', () => {
      expect(comboMultiplier(100, 8)).toBe(8)
    })
    it('uses each kasta cap', () => {
      const cap = KASTA_DEFS[2].comboMultiplierCap // singgahsini
      expect(comboMultiplier(100, cap)).toBe(cap)
    })
    it('Mode Kos Impian cap is Infinity → never caps', () => {
      const cap = KASTA_DEFS[3].comboMultiplierCap
      expect(cap).toBe(Infinity)
      expect(comboMultiplier(1000, cap)).toBeGreaterThan(8)
    })
  })

  describe('nearMissText', () => {
    it('escalates from Nyaris to GILA to DPO', () => {
      expect(nearMissText(1)).toBe('Nyaris!')
      expect(nearMissText(2)).toBe('Nyaris!')
      expect(nearMissText(3)).toBe('GILA!')
      expect(nearMissText(6)).toBe('GILA!')
      expect(nearMissText(7)).toBe('DPO!')
    })
  })
})

describe('PlayScene score accumulator (jarak × combo multiplier)', () => {
  // Minimal game stub satisfying PlayScene construction without entering the
  // full scene graph. We poke scene state directly to exercise _updateDistance.
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
    scene.spd = 260 // BASE_SPEED
    scene.combo.reset()
    return scene
  }

  it('starts at score 0 in enter()', () => {
    const s = mkScene()
    s.enter()
    expect(s.score).toBe(0)
  })

  it('integrates score = meters × multiplier each frame', () => {
    const s = mkScene()
    s.enter()
    // No combo: mult = 1 → score grows exactly like distance.
    const distBefore = s.dist
    const scoreBefore = s.score
    s._updateDistance(0.5) // 0.5s at 260 px/s → (260/200)*0.5 = 0.65m
    expect(s.dist).toBeCloseTo(distBefore + 0.65, 5)
    expect(s.score).toBeCloseTo(scoreBefore + 0.65 * 1, 5)
  })

  it('an aggressive short run outscores a cautious long run at the same distance', () => {
    // Cautious: 100m at mult=1 the whole way → score ≈ 100.
    const cautious = mkScene()
    cautious.enter()
    cautious.spd = 2000 // big speed → integrate meters quickly
    for (let i = 0; i < 10; i++) cautious._updateDistance(1)
    const cautiousDist = cautious.dist
    const cautiousScore = cautious.score
    expect(cautiousScore).toBeCloseTo(cautiousDist, 3)

    // Aggressive: same distance but mult = 8 the whole way → score ≈ 8× distance.
    const aggressive = mkScene()
    aggressive.enter()
    aggressive.spd = 2000
    aggressive.combo.combo = 16 // mult = 2^floor(16/2) = 256, but cap with tier 0
    aggressive.combo.mult = 8 // tier-0 cap (KASTA_DEFS[0].comboMultiplierCap)
    for (let i = 0; i < 10; i++) aggressive._updateDistance(1)
    expect(aggressive.dist).toBeCloseTo(cautiousDist, 3)
    expect(aggressive.score).toBeGreaterThan(cautiousScore * 5) // ~8× but allow slack
  })
})

describe('storage (high-score = score)', () => {
  // No jsdom in this suite, so storage.js's `window.localStorage` is guarded
  // by try/catch and silently returns 0. Inject a fake window to exercise it.
  beforeEach(() => {
    const _d = {}
    const store = {
      getItem: (k) => _d[k] ?? null,
      setItem: (k, v) => {
        _d[k] = String(v)
      },
    }
    vi.stubGlobal('window', { localStorage: store })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 0 when nothing is stored', () => {
    expect(getHighScore()).toBe(0)
  })

  it('persists a new best and returns it', () => {
    expect(submitScore(1500)).toBe(1500)
    expect(getHighScore()).toBe(1500)
  })

  it('does not overwrite when the run did not beat the stored best', () => {
    submitScore(1500)
    expect(submitScore(800)).toBe(1500)
    expect(getHighScore()).toBe(1500)
  })

  it('a higher score replaces the stored best', () => {
    submitScore(1500)
    expect(submitScore(3000)).toBe(3000)
    expect(getHighScore()).toBe(3000)
  })
})
