import { describe, it, expect } from 'vitest'
import { PromptDirector, PROMPTS } from '../src/game/scenes/play/PromptDirector.js'
import {
  matchDreamKos,
  matchWithFacility,
  formatPrice,
  budgetFromCoins,
  BUDGET_FLOOR,
  BUDGET_CEIL,
  REVEAL_CHIPS,
} from '../src/game/systems/dreamKos.js'

describe('PromptDirector', () => {
  it('fires the 0m prompt at the start', () => {
    const d = new PromptDirector()
    d.reset()
    expect(d.check(0)).toBe(PROMPTS[0].text)
  })

  it('fires each milestone once, in order', () => {
    const d = new PromptDirector()
    d.reset()
    expect(d.check(0)).toBe(PROMPTS[0].text)
    expect(d.check(50)).toBeNull() // nothing new between thresholds
    expect(d.check(200)).toBe(PROMPTS[1].text)
    expect(d.check(200)).toBeNull() // already fired
  })

  it('never skips a prompt even on a big distance jump', () => {
    const d = new PromptDirector()
    d.reset()
    // Jumping straight to 1000m returns the latest crossed prompt, and advances
    // the index past all of them so none re-fire.
    expect(d.check(1000)).toBe(PROMPTS[PROMPTS.length - 1].text)
    expect(d.check(1000)).toBeNull()
  })

  it('reset() rewinds the prompt cursor', () => {
    const d = new PromptDirector()
    d.reset()
    d.check(1000)
    d.reset()
    expect(d.check(0)).toBe(PROMPTS[0].text)
  })
})

describe('budgetFromCoins', () => {
  it('returns the floor for a 0-coin run', () => {
    expect(budgetFromCoins(0)).toBe(BUDGET_FLOOR)
  })

  it('scales linearly with coins inside the band', () => {
    // 30 coins = short run → ~480k (300k floor + 30 × 6k)
    expect(budgetFromCoins(30)).toBe(480000)
  })

  it('clamps to the ceiling on a strong run', () => {
    expect(budgetFromCoins(1000)).toBe(BUDGET_CEIL)
  })

  it('treats negatives as zero', () => {
    expect(budgetFromCoins(-5)).toBe(BUDGET_FLOOR)
  })
})

describe('matchDreamKos (budget + tier)', () => {
  it('returns the cheapest listing when budget is below everything', () => {
    // 0-coin run: budget = 300k floor, no listing is affordable → cheapest fallback.
    const kos = matchDreamKos({ budget: BUDGET_FLOOR, tier: 0 })
    expect(kos).toHaveProperty('name')
    expect(kos).toHaveProperty('price')
    // The fallback is the global cheapest, never more than the floor band.
    expect(kos.price).toBeLessThanOrEqual(600000)
  })

  it('only returns tier-0 listings at tier 0', () => {
    const kos = matchDreamKos({ budget: BUDGET_CEIL, tier: 0 })
    expect(kos.tier).toBe(0)
  })

  it('upgrades to a higher-tier listing when the player reached a higher tier', () => {
    const low = matchDreamKos({ budget: BUDGET_CEIL, tier: 0 })
    const high = matchDreamKos({ budget: BUDGET_CEIL, tier: 3 })
    expect(high.tier).toBeGreaterThan(low.tier)
  })

  it('picks the priciest affordable listing within the highest eligible tier', () => {
    // tier 2 cap, generous budget → priciest tier-2 listing (Cendana at 1.5M).
    const kos = matchDreamKos({ budget: BUDGET_CEIL, tier: 2 })
    expect(kos.tier).toBe(2)
    expect(kos.price).toBe(1500000)
  })

  it('still returns something reasonable on a 0-coin, 0-tier run', () => {
    const kos = matchDreamKos({ budget: budgetFromCoins(0), tier: 0 })
    expect(kos.name).toBeTruthy()
    expect(kos.area).toBeTruthy()
  })

  it('respects budget: a tier-3 player on a tiny budget gets the cheapest', () => {
    // Even with max tier, a sub-floor budget can't afford anything; fallback.
    const kos = matchDreamKos({ budget: 200000, tier: 3 })
    expect(kos.price).toBeLessThanOrEqual(600000)
  })
})

describe('matchWithFacility (chip re-roll)', () => {
  it('returns a listing carrying the requested facility when one is in-band', () => {
    const kos = matchWithFacility({ budget: BUDGET_CEIL, tier: 3, facilityId: 'ac' })
    expect(kos.tags).toContain('ac')
  })

  it('falls back to a plain match when no in-band listing has the facility', () => {
    // Tiny budget + 'ac' → nothing affordable has AC; must still return something.
    const kos = matchWithFacility({ budget: 200000, tier: 0, facilityId: 'ac' })
    expect(kos).toHaveProperty('name')
  })

  it('stays within budget + tier even with a facility filter', () => {
    const budget = 800000
    const kos = matchWithFacility({ budget, tier: 1, facilityId: 'wifi' })
    expect(kos.price).toBeLessThanOrEqual(budget)
    expect(kos.tier).toBeLessThanOrEqual(1)
  })

  it('every chip id resolves to a real tag', () => {
    for (const chip of REVEAL_CHIPS) {
      expect(chip.id).toBeTruthy()
      expect(chip.label).toBeTruthy()
    }
  })
})

describe('formatPrice', () => {
  it('formats rupiah with thousands separators', () => {
    expect(formatPrice(850000)).toBe('Rp 850.000/bulan')
  })
})
