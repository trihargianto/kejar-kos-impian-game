import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadSettings,
  saveSettings,
  activeDifficulty,
  DIFFICULTY_PRESETS,
  DIFFICULTY_ORDER,
  _resetCache,
} from '../src/game/systems/settings.js'

// settings.js reads/writes window.localStorage with a try/catch guard. Inject a
// fake store (no jsdom in this suite) and reset the in-memory cache each test.
describe('settings', () => {
  let store
  beforeEach(() => {
    const _d = {}
    store = {
      getItem: (k) => _d[k] ?? null,
      setItem: (k, v) => {
        _d[k] = String(v)
      },
    }
    vi.stubGlobal('window', { localStorage: store })
    _resetCache()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    _resetCache()
  })

  it('defaults when nothing is stored', () => {
    const s = loadSettings()
    expect(s.sfx).toBe(true)
    expect(s.difficulty).toBe('medium')
  })

  it('persists a partial update and merges with existing', () => {
    saveSettings({ sfx: false })
    _resetCache()
    const s = loadSettings()
    expect(s.sfx).toBe(false)
    expect(s.difficulty).toBe('medium') // untouched
  })

  it('rejects an unknown difficulty, falling back to default', () => {
    expect(saveSettings({ difficulty: 'nope' }).difficulty).toBe('medium')
  })

  it('activeDifficulty returns the selected preset object', () => {
    saveSettings({ difficulty: 'hard' })
    expect(activeDifficulty()).toBe(DIFFICULTY_PRESETS.hard)
  })

  it('survives a corrupt stored value', () => {
    store.getItem = () => '{not json'
    _resetCache()
    expect(loadSettings().difficulty).toBe('medium')
  })
})

describe('difficulty presets', () => {
  it('covers easy/medium/hard in order', () => {
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'medium', 'hard'])
  })

  it('medium is the neutral baseline (all multipliers 1.0)', () => {
    const m = DIFFICULTY_PRESETS.medium
    expect(m.speed).toBe(1)
    expect(m.ramp).toBe(1)
    expect(m.spawn).toBe(1)
    expect(m.iframes).toBe(1)
    expect(m.lives).toBe(3)
  })

  it('easy is more forgiving, hard is harsher', () => {
    const { easy, hard } = DIFFICULTY_PRESETS
    expect(easy.lives).toBeGreaterThan(hard.lives)
    expect(easy.speed).toBeLessThan(hard.speed)
    expect(easy.spawn).toBeGreaterThan(hard.spawn) // bigger interval = rarer
    expect(easy.iframes).toBeGreaterThan(hard.iframes)
  })
})
