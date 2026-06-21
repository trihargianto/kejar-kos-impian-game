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
    // see GameCanvas. So touch here does ONE thing: a tap emits `Tap`, which
    // INTENT.confirm uses to advance the Start / GameOver menus (those screens
    // have no buttons). No swipe/gesture parsing, no tap-vs-swipe ambiguity.
    this._onTouchStart = (e) => {
      e.preventDefault() // block page scroll/zoom on the canvas
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

  justPressed(code) {
    return !!this._justPressed[code]
  }

  // True if any of the given codes had a fresh press this frame.
  anyPressed(codes) {
    return codes.some((c) => this._justPressed[c])
  }

  isDown(code) {
    return !!this.keys[code]
  }

  flush() {
    this._justPressed = {}
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
