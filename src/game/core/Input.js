// ─── Input tracker ──────────────────────────────────────────────────────────
// Tracks held keys and per-frame "just pressed" edges for keys + touch gestures.
// Call flush() once at the end of each frame to clear the edge buffer.

export class Input {
  constructor(canvas) {
    this.keys = {}
    this._justPressed = {}

    this._onKeyDown = (e) => {
      if (!this.keys[e.code]) this._justPressed[e.code] = true
      this.keys[e.code] = true
    }
    this._onKeyUp = (e) => {
      this.keys[e.code] = false
    }
    // All in-play actions (jump/slide/dash/throw) are on-screen buttons now —
    // see GameCanvas. So touch here does TWO things: emit a `Tap` edge (used by
    // INTENT.confirm to advance Start/GameOver menus), AND record the tap
    // position in canvas-CSS-px space so scenes can hit-test in-canvas targets
    // (e.g. the facility chips on the result screen). Position is cleared each
    // flush alongside the edge, so a tap is consumed exactly once.
    this._onTouchStart = (e) => {
      e.preventDefault() // block page scroll/zoom on the canvas
      const rect = this._canvas.getBoundingClientRect()
      const t = e.touches?.[0]
      if (t) this._tapPos = { x: t.clientX - rect.left, y: t.clientY - rect.top }
      this._justPressed.Tap = true
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false })

    this._canvas = canvas
  }

  // Inject a one-frame "just pressed" edge from an on-screen button. One edge
  // per frame per code is exactly right: each physical tap lands in its own
  // frame, so tap-tap on JUMP becomes jump + double jump. (The button fires this
  // from touchstart only — never also from a synthesized mouse event — so a
  // single tap can't double-count and burn both jumps at once.)
  pressVirtual(code) {
    this._justPressed[code] = true
  }

  // Hold/release a virtual code so on-screen buttons can be HELD, not just
  // tapped. holdVirtual also fires the press edge (so the first frame both
  // presses and is down); releaseVirtual clears the held state. Used by the
  // SLIDE button for hold-to-slide.
  holdVirtual(code) {
    if (!this.keys[code]) this._justPressed[code] = true
    this.keys[code] = true
  }

  releaseVirtual(code) {
    this.keys[code] = false
  }

  justPressed(code) {
    return !!this._justPressed[code]
  }

  // Position (canvas-CSS-px) of the most recent Tap edge this frame, or null if
  // no tap. Cleared on flush. Scenes use this for in-canvas hit-testing.
  get tapPos() {
    return this._tapPos ?? null
  }

  // True if any of the given codes had a fresh press this frame.
  anyPressed(codes) {
    return codes.some((c) => this._justPressed[c])
  }

  // True if any of the given codes is currently held down (keyboard key or a
  // held virtual button). Used for hold-to-slide.
  anyDown(codes) {
    return codes.some((c) => this.keys[c])
  }

  isDown(code) {
    return !!this.keys[code]
  }

  flush() {
    this._justPressed = {}
    this._tapPos = null
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this._canvas.removeEventListener('touchstart', this._onTouchStart)
  }
}

// ─── Named input intents ──────────────────────────────────────────────────────
// Maps gameplay actions to the raw codes that trigger them. Scenes query intents
// instead of raw keys, so rebinding lives in one place.
//
// Control scheme — all in-play actions are on-screen buttons (see GameCanvas),
// so there are no touch gestures to learn or mis-read. Each action maps to a
// Button:* virtual code (pushed by the button) plus keyboard keys for desktop
// and tests. `confirm` keeps Tap so a plain screen tap advances the menus, which
// have no buttons of their own.
export const INTENT = {
  jump: ['Space', 'ArrowUp', 'KeyW', 'Button:Jump'],
  slide: ['ArrowDown', 'KeyS', 'Button:Slide'],
  dash: ['ShiftLeft', 'ShiftRight', 'ArrowRight', 'Button:Dash'],
  throw: ['KeyQ', 'Button:Throw'], // Sandal Jepit (active power-up)
  confirm: ['Space', 'Enter', 'Tap', 'ArrowUp'],
}
