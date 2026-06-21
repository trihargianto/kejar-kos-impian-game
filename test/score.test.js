import { describe, it, expect } from 'vitest'
import {
  getRank,
  getKasta,
  comboMultiplier,
  nearMissText,
} from '../src/game/systems/score.js'
import { getKastaDef, KASTA_DEFS, getNextKastaThreshold } from '../src/game/kasta.js'

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
