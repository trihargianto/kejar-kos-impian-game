// Tiny input tracker
export class Input {
  constructor(canvas) {
    this.keys = {}
    this._justPressed = {}

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this._justPressed[e.code] = true
      this.keys[e.code] = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
    })

    // Touch
    this.touchStart = null
    canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault()
        this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      },
      { passive: false }
    )
    canvas.addEventListener(
      'touchend',
      (e) => {
        if (!this.touchStart) return
        const dx = e.changedTouches[0].clientX - this.touchStart.x
        const dy = e.changedTouches[0].clientY - this.touchStart.y
        const adx = Math.abs(dx),
          ady = Math.abs(dy)
        if (adx < 15 && ady < 15) this._justPressed['Tap'] = true
        else if (dy > 30 && ady > adx) this._justPressed['SwipeDown'] = true
        else if (dx > 30 && adx > ady) this._justPressed['SwipeRight'] = true
        this.touchStart = null
      },
      { passive: false }
    )
  }

  justPressed(code) {
    return !!this._justPressed[code]
  }

  isDown(code) {
    return !!this.keys[code]
  }

  flush() {
    this._justPressed = {}
  }
}

// Simple shake system
export class Shake {
  constructor() {
    this.time = 0
    this.strength = 0
  }
  trigger(str = 8, dur = 0.25) {
    this.strength = str
    this.time = dur
  }
  update(dt) {
    if (this.time > 0) this.time -= dt
  }
  offset() {
    if (this.time <= 0) return { x: 0, y: 0 }
    const s = this.strength * (this.time / 0.25)
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s }
  }
}
