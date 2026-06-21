import { describe, it, expect } from 'vitest'
import { EventBus } from '../src/game/core/EventBus.js'
import { StateMachine } from '../src/game/core/State.js'
import { Pool } from '../src/game/core/Pool.js'

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus()
    const received = []
    bus.on('test:event', (p) => received.push(p))
    bus.emit('test:event', { a: 1 })
    expect(received).toEqual([{ a: 1 }])
  })

  it('supports multiple subscribers for one event', () => {
    const bus = new EventBus()
    let count = 0
    bus.on('e', () => count++)
    bus.on('e', () => count++)
    bus.emit('e')
    expect(count).toBe(2)
  })

  it('returns an unsubscribe function', () => {
    const bus = new EventBus()
    const calls = []
    const off = bus.on('e', () => calls.push(1))
    off()
    bus.emit('e')
    expect(calls).toHaveLength(0)
  })

  it('once() fires only on first emit', () => {
    const bus = new EventBus()
    const seen = []
    bus.once('e', (p) => seen.push(p))
    bus.emit('e', 1)
    bus.emit('e', 2)
    expect(seen).toEqual([1])
  })

  it('isolates failures so one bad listener cannot kill the loop', () => {
    const bus = new EventBus()
    const ok = []
    bus.on('e', () => {
      throw new Error('boom')
    })
    bus.on('e', () => ok.push('survived'))
    bus.emit('e')
    expect(ok).toEqual(['survived'])
  })

  it('no-op emit on unknown event', () => {
    const bus = new EventBus()
    expect(() => bus.emit('nothing')).not.toThrow()
  })
})

describe('StateMachine', () => {
  function buildCounterFsm() {
    const log = []
    const fsm = new StateMachine(
      'idle',
      {
        idle: {
          enter: () => log.push('enter:idle'),
          on: (event) => (event === 'go' ? 'active' : null),
          exit: () => log.push('exit:idle'),
        },
        active: {
          enter: () => log.push('enter:active'),
          on: (event) => (event === 'stop' ? 'idle' : null),
          exit: () => log.push('exit:active'),
        },
      },
      {},
    )
    return { fsm, log }
  }

  it('calls enter on the initial state', () => {
    const { log } = buildCounterFsm()
    expect(log[0]).toBe('enter:idle')
  })

  it('transitions on send()', () => {
    const { fsm } = buildCounterFsm()
    fsm.send('go')
    expect(fsm.is('active')).toBe(true)
  })

  it('calls exit then enter on transition', () => {
    const { fsm, log } = buildCounterFsm()
    log.length = 0
    fsm.send('go')
    expect(log).toEqual(['exit:idle', 'enter:active'])
  })

  it('ignores unknown events', () => {
    const { fsm } = buildCounterFsm()
    fsm.send('bogus')
    expect(fsm.is('idle')).toBe(true)
  })

  it('tracks time in state', () => {
    const { fsm } = buildCounterFsm()
    fsm.update(0.1)
    fsm.update(0.2)
    expect(fsm.timeInState).toBeCloseTo(0.3, 5)
  })

  it('refuses transitions to unknown states', () => {
    const { fsm } = buildCounterFsm()
    expect(fsm.transition('nope')).toBe(false)
  })

  it('passes ctx to exit handlers (regression: slide-jam bug)', () => {
    // exit() and enter() must have the same signature so ctx is reachable
    // from either side. A previous version passed ctx only to enter, which
    // crashed when sliding-state.exit tried to mutate the player.
    const ctx = { touched: false }
    const fsm = new StateMachine(
      'a',
      {
        a: { on: () => 'b' },
        b: {
          enter: (_prev, _payload, c) => (c.entered = true),
          exit: (_next, _payload, c) => (c.touched = true),
        },
      },
      ctx,
    )
    fsm.send('go')
    fsm.transition('a')
    expect(ctx.entered).toBe(true)
    expect(ctx.touched).toBe(true)
  })
})

describe('Pool', () => {
  it('acquire/release round-trips objects', () => {
    const pool = new Pool(() => ({ id: 0 }), (o, id) => (o.id = id), 4)
    const a = pool.acquire(1)
    expect(a.id).toBe(1)
    pool.release(a)
    const b = pool.acquire(2)
    expect(b).toBe(a) // same object reused
    expect(b.id).toBe(2)
  })

  it('counts active vs pooled', () => {
    const pool = new Pool(() => ({}), () => {}, 4, 2)
    expect(pool.pooled).toBe(2)
    expect(pool.active).toBe(0)
    const a = pool.acquire()
    expect(pool.active).toBe(1)
    expect(pool.pooled).toBe(1)
    pool.release(a)
    expect(pool.active).toBe(0)
    expect(pool.pooled).toBe(2)
  })

  it('returns null at cap when no free instances', () => {
    const pool = new Pool(() => ({}), () => {}, 1, 0)
    pool.acquire()
    expect(pool.acquire()).toBeNull()
  })
})
