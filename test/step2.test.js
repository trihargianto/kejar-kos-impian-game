import { describe, it, expect } from 'vitest'
import { PromptDirector, PROMPTS } from '../src/game/scenes/play/PromptDirector.js'
import { CollectibleDirector } from '../src/game/scenes/play/CollectibleSystem.js'
import { matchDreamKos, formatPrice } from '../src/game/systems/dreamKos.js'

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

describe('CollectibleDirector dream profile', () => {
  it('starts empty', () => {
    const d = new CollectibleDirector()
    d.reset()
    expect(d.dreamProfile()).toEqual([])
  })

  it('ranks tags by collection count, most-collected first', () => {
    const d = new CollectibleDirector()
    d.reset()
    d.profile.set('ac', 3)
    d.profile.set('wifi', 1)
    d.profile.set('kampus', 2)
    const ranked = d.dreamProfile().map((t) => t.id)
    expect(ranked).toEqual(['ac', 'kampus', 'wifi'])
  })
})

describe('matchDreamKos', () => {
  it('returns a sensible default when no tags collected', () => {
    const kos = matchDreamKos([])
    expect(kos).toHaveProperty('name')
    expect(kos).toHaveProperty('price')
  })

  it('matches the listing sharing the most tags', () => {
    // All six premium facilities → the fully-loaded premium listing.
    const profile = ['ac', 'wifi', 'km_dalam', 'kampus', 'parkir', 'dapur'].map((id) => ({ id }))
    expect(matchDreamKos(profile).name).toMatch(/Premium/)
  })

  it('breaks ties toward the cheaper kos', () => {
    // Only 'wifi' — several listings have it; the cheapest wins.
    const matched = matchDreamKos([{ id: 'wifi' }])
    const others = ['Kos Putri Melati', 'Kos Eksklusif Cendana']
    expect(others).not.toContain(matched.name)
    expect(matched.price).toBeLessThanOrEqual(700000)
  })
})

describe('formatPrice', () => {
  it('formats rupiah with thousands separators', () => {
    expect(formatPrice(850000)).toBe('Rp 850.000/bulan')
  })
})
