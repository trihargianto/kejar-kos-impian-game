// ─── Finite state machine ─────────────────────────────────────────────────────
// Generic FSM. Replaces boolean flag soup (sliding && dashing && invincible ...)
// with one current state + guarded transitions. Each state can declare:
//   enter(prev, payload)  — called on entry
//   update(dt, ctx)       — called every frame while active
//   exit(next)            — called on exit
//   on(event, payload)    — input/event handler; return a state name to transition
//
// Usage:
//   const fsm = new StateMachine('idle', { idle: {...}, jumping: {...} }, ctx)
//   fsm.send('jump')
//   fsm.update(dt)

export class StateMachine {
  constructor(initial, states, ctx = {}) {
    this.states = states
    this.ctx = ctx
    this.current = initial
    this.previous = null
    this.timeInState = 0
    this.states[initial]?.enter?.(null, undefined, ctx)
  }

  get state() {
    return this.current
  }

  is(name) {
    return this.current === name
  }

  // Transition to a new state. Returns true if transition happened.
  transition(name, payload) {
    if (name === this.current || !this.states[name]) return false
    this.previous = this.current
    // exit and enter share the same signature (other, payload, ctx) so handlers
    // can rely on `ctx` regardless of which side they're on.
    this.states[this.previous]?.exit?.(name, payload, this.ctx)
    this.current = name
    this.timeInState = 0
    this.states[name]?.enter?.(this.previous, payload, this.ctx)
    return true
  }

  // Send a named input/event to the current state.
  // If the handler returns a state name, transition to it.
  send(event, payload) {
    const handler = this.states[this.current]?.on
    if (!handler) return false
    const next = handler(event, payload, this.ctx)
    if (next) return this.transition(next, payload)
    return false
  }

  update(dt) {
    this.timeInState += dt
    this.states[this.current]?.update?.(dt, this.ctx)
  }
}
