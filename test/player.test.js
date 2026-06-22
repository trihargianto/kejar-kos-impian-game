import { describe, it, expect } from 'vitest'
import { Player } from '../src/game/entities/Player.js'
import { SLIDE_DURATION } from '../src/game/constants.js'

const mkGame = (over = {}) => ({
  scale: 1,
  width: 390,
  floorY: 724,
  ...over,
})

// Step physics frames so gravity/jump actually move the player. Player.reset
// leaves grounded=false; the first update tick snaps the player to the floor.
const settle = (p, frames = 3, dt = 0.016) => {
  for (let i = 0; i < frames; i++) p.update(dt)
}

describe('Player air-slide (buffered; fires on natural landing)', () => {
  it('pressing SLIDE mid-air does NOT snap the player to the floor', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.jump()
    settle(p)
    const airborneY = p.y
    expect(p.grounded).toBe(false)
    expect(airborneY).toBeLessThan(p.floorY - p.baseH)

    p.slide()
    // No y-snap: player stays exactly where they were in the air.
    expect(p.y).toBe(airborneY)
    expect(p.grounded).toBe(false)
    expect(p.sliding).toBe(false)
    // The press is buffered.
    expect(p._slideQueued).toBe(true)
  })

  it('the buffered slide fires on the frame the player lands naturally', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.jump()
    settle(p)
    p.slide() // queue the slide
    expect(p.sliding).toBe(false)

    // Step until gravity brings the player back to the floor.
    // Free-fall from a single jump closes in well under 1s at GRAVITY=2400.
    let landed = false
    for (let i = 0; i < 200 && !landed; i++) {
      p.update(0.016)
      if (p.sliding) landed = true
    }
    expect(landed).toBe(true)
    expect(p.grounded).toBe(true)
    expect(p._slideQueued).toBe(false) // consumed
    expect(p.slideTimer).toBeCloseTo(SLIDE_DURATION, 5)
  })

  it('re-pressing SLIDE while sliding restarts the slide timer (fresh slide)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide() // enter slide (grounded)
    expect(p.sliding).toBe(true)
    // Burn ~0.3s of the slide, then re-press.
    for (let i = 0; i < 18; i++) p.update(0.016) // ~0.29s
    const before = p.slideTimer
    expect(before).toBeLessThan(SLIDE_DURATION) // some time already elapsed
    p.slide() // fresh slide
    expect(p.slideTimer).toBeCloseTo(SLIDE_DURATION, 5) // reset to full, not stacked
    expect(p.sliding).toBe(true)
  })

  it('holdSlide() refreshes the timer while sliding without re-entering', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide()
    for (let i = 0; i < 18; i++) p.update(0.016) // burn ~0.29s
    const before = p.slideTimer
    const floats = (() => {
      p.holdSlide()
      return p._drainFloats()
    })()
    expect(p.slideTimer).toBeCloseTo(SLIDE_DURATION, 5) // refreshed to full
    expect(floats).toHaveLength(0) // quiet: no SLIDE! float spam
    expect(before).toBeLessThan(SLIDE_DURATION)
  })

  it('holdSlide() does nothing when not sliding (entering is the press edge job)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    expect(p.sliding).toBe(false)
    p.holdSlide()
    expect(p.sliding).toBe(false)
    expect(p.slideTimer).toBe(0)
  })

  it('holding SLIDE (press then refresh each frame) keeps the player down', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide() // press edge enters the slide
    for (let i = 0; i < 120; i++) {
      p.update(0.016)
      p.holdSlide() // simulate the button being held every frame
      expect(p.sliding).toBe(true)
    }
  })

  it('tapping SLIDE repeatedly keeps the player sliding (hold-to-slide)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide()
    // Re-press every ~0.5s for well past a single SLIDE_DURATION; never drops.
    for (let i = 0; i < 120; i++) {
      p.update(0.016)
      if (i % 30 === 0) p.slide() // tap roughly twice per second
      expect(p.sliding).toBe(true)
    }
  })

  it('jump after an air-slide press cancels the queue', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.jump()
    settle(p)
    p.slide() // queue
    expect(p._slideQueued).toBe(true)

    p.jump() // double-jump → supersedes
    expect(p._slideQueued).toBe(false)

    // Land naturally — no slide should fire.
    for (let i = 0; i < 200; i++) p.update(0.016)
    expect(p.sliding).toBe(false)
  })

  it('air-slide press emits a small ↓ cue (NOT the SLIDE! float)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.jump()
    settle(p)
    const floats = p.slide()
    expect(floats.some((f) => f.text === '↓')).toBe(true)
    expect(floats.some((f) => f.text === 'SLIDE!')).toBe(false)
  })

  it('ground slide still works exactly as before (no buffering)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    expect(p.grounded).toBe(true)

    const floats = p.slide()
    expect(p.sliding).toBe(true)
    expect(p.slideTimer).toBeCloseTo(SLIDE_DURATION, 5)
    expect(floats.some((f) => f.text === 'SLIDE!')).toBe(true)
    expect(p._slideQueued).toBe(false)
  })

  it('a buffered air-slide does not change physics (gravity still applies)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.jump()
    // Step past the jump apex so the player is descending (vy > 0).
    for (let i = 0; i < 25; i++) p.update(0.016)
    expect(p.vy).toBeGreaterThan(0)

    p.slide() // queue while descending
    const yBefore = p.y
    const vyBefore = p.vy

    p.update(0.016)
    // Same integration as a normal fall: vy grows, y moves toward floor.
    expect(p.vy).toBeGreaterThan(vyBefore)
    expect(p.y).toBeGreaterThan(yBefore)
    expect(p.grounded).toBe(false)
  })
})

describe('Player jump-out-of-slide', () => {
  it('one JUMP press from a slide both cancels the slide AND launches into air', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide()
    expect(p.sliding).toBe(true)
    expect(p.grounded).toBe(true)

    const floats = p.jump()
    expect(p.sliding).toBe(false) // slide exited
    expect(p.grounded).toBe(false) // airborne
    expect(p.vy).toBeLessThan(0) // moving up
    expect(p.jumps).toBe(1) // one jump spent
    expect(floats.some((f) => f.text === '↑')).toBe(true)
  })

  it('slide-hop loop: slide → jump → land → slide → jump (sustainable)', () => {
    const p = new Player(mkGame())
    p.reset()
    settle(p)

    p.slide()
    expect(p.sliding).toBe(true)
    p.jump()
    expect(p.sliding).toBe(false)
    expect(p.grounded).toBe(false)

    // Land naturally.
    for (let i = 0; i < 200 && !p.grounded; i++) p.update(0.016)
    expect(p.grounded).toBe(true)

    // Slide again, jump again.
    p.slide()
    expect(p.sliding).toBe(true)
    p.jump()
    expect(p.sliding).toBe(false)
    expect(p.vy).toBeLessThan(0)
  })

  it('jump-out-of-slide does not get cancelled by gravity snapping back', () => {
    // Regression: if p.y stays at the slide pose position (floorY - baseH/2),
    // the next applyGravity sees y >= floorTop and zeroes the jump velocity.
    // The fix resets p.y to the standing floor position on slide-exit.
    const p = new Player(mkGame())
    p.reset()
    settle(p)
    p.slide()
    p.jump()
    const vyAtJump = p.vy

    p.update(0.016)
    // Jump velocity is preserved (only gravity dents it slightly), not zeroed.
    expect(p.vy).toBeLessThan(0)
    expect(p.vy).toBeGreaterThan(vyAtJump - 100) // gravity dents by < 100/frame
    expect(p.grounded).toBe(false)
  })
})
