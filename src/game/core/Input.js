// ─── Input tracker ──────────────────────────────────────────────────────────
// Tracks held keys and per-frame "just pressed" edges for keys + touch gestures.
// Call flush() once at the end of each frame to clear the edge buffer.

const SWIPE_THRESHOLD = 30 // px travel to count as a swipe
const TAP_THRESHOLD = 15 // px max travel to count as a tap

export class Input {
  constructor(canvas) {
    this.keys = {}
    this._justPressed = {}
    this.touchStart = null

    this._onKeyDown = (e) => {
      if (!this.keys[e.code]) this._justPressed[e.code] = true
      this.keys[e.code] = true
    }
    this._onKeyUp = (e) => {
      this.keys[e.code] = false
    }
    this._onTouchStart = (e) => {
      e.preventDefault()
      this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    this._onTouchEnd = (e) => {
      if (!this.touchStart) return
      const dx = e.changedTouches[0].clientX - this.touchStart.x
      const dy = e.changedTouches[0].clientY - this.touchStart.y
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      if (adx < TAP_THRESHOLD && ady < TAP_THRESHOLD) this._justPressed.Tap = true
      else if (dy > SWIPE_THRESHOLD && ady > adx) this._justPressed.SwipeDown = true
      else if (dy < -SWIPE_THRESHOLD && ady > adx) this._justPressed.SwipeUp = true
      else if (dx > SWIPE_THRESHOLD && adx > ady) this._justPressed.SwipeRight = true
      this.touchStart = null
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false })
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false })

    this._canvas = canvas
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
    this._canvas.removeEventListener('touchend', this._onTouchEnd)
  }
}

// ─── Named input intents ──────────────────────────────────────────────────────
// Maps gameplay actions to the raw codes that trigger them. Scenes query intents
// instead of raw keys, so rebinding lives in one place.
//
// Note: SwipeUp is reserved for the Sandal Jepit throw (GDD §VII), NOT jump.
// Mobile jump = Tap. Desktop jump = Space / ArrowUp / W.
export const INTENT = {
  jump: ['Space', 'ArrowUp', 'KeyW', 'Tap'],
  slide: ['ArrowDown', 'KeyS', 'SwipeDown'],
  dash: ['ShiftLeft', 'ShiftRight', 'ArrowRight', 'SwipeRight'],
  throw: ['SwipeUp', 'KeyQ'], // Sandal Jepit (active power-up)
  confirm: ['Space', 'Enter', 'Tap', 'ArrowUp'],
}
