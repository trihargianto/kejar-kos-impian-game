// ─── Game ──────────────────────────────────────────────────────────────────────
// Owns the canvas, the main loop, and the shared context handed to every scene.
// All gameplay lives in scenes (start / play / gameover); this file only wires
// them together and drives the frame.
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js'
import { COLORS } from './theme.js'
import { Input } from './core/Input.js'
import { Shake } from './core/Shake.js'
import { SceneManager } from './core/SceneManager.js'
import { StartScene } from './scenes/StartScene.js'
import { PlayScene } from './scenes/PlayScene.js'
import { GameOverScene } from './scenes/GameOverScene.js'

const MAX_DT = 0.05 // clamp huge frame gaps (tab switch) to avoid tunneling

export class Game {
  constructor(canvas, { safeTop = 0, safeBottom = 0, dpr = 1 } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.input = new Input(canvas)
    this.shake = new Shake()
    this.floats = []
    this.lastDist = 0
    this.safeTop = safeTop
    this.safeBottom = safeBottom

    // Game logic works in CSS pixels; ctx is pre-scaled to physical pixels
    this.width = Math.round(canvas.width / dpr)
    this.height = Math.round(canvas.height / dpr)
    this.scale = this.width / GAME_WIDTH
    this.floorY = Math.round((GAME_HEIGHT - 120) / GAME_HEIGHT * this.height)

    // Scale context once so all draw calls use CSS pixel coordinates
    this.ctx.scale(dpr, dpr)

    this._scenes = new SceneManager()
    this._scenes
      .register('start', new StartScene(this))
      .register('play', new PlayScene(this))
      .register('gameover', new GameOverScene(this))

    this._last = null
    this._loop = this._loop.bind(this)
    this._scenes.go('start')
    this._raf = requestAnimationFrame(this._loop)
  }

  // Shared scene helper: a scene calls this to transition.
  go(name) {
    this._scenes.go(name)
  }

  destroy() {
    cancelAnimationFrame(this._raf)
    this.input.destroy()
  }

  _loop(ts) {
    this._raf = requestAnimationFrame(this._loop)
    const dt = this._last ? Math.min((ts - this._last) / 1000, MAX_DT) : 0.016
    this._last = ts

    // Update
    this.shake.update(dt)
    this._scenes.update(dt)
    this.floats.forEach((f) => f.update(dt))
    this.floats = this.floats.filter((f) => !f.dead())

    // Draw (under shake transform)
    const ctx = this.ctx
    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)
    this._scenes.draw(ctx)
    this.floats.forEach((f) => f.draw(ctx))
    ctx.restore()

    this.input.flush()
  }

  // Shared floor render used by multiple scenes.
  drawFloor(ctx) {
    ctx.fillStyle = COLORS.floor
    ctx.fillRect(0, this.floorY, this.width, this.height - this.floorY)
    ctx.fillStyle = COLORS.floorLine
    ctx.fillRect(0, this.floorY, this.width, Math.max(2, Math.round(this.scale * 4)))
  }
}
