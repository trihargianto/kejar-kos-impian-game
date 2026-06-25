// ─── Game ──────────────────────────────────────────────────────────────────────
// Owns the canvas, the main loop, and the shared context handed to every scene.
// All gameplay lives in scenes (start / play / gameover); this file only wires
// them together and drives the frame.
import { GAME_WIDTH, GAME_HEIGHT, FLOOR_HEIGHT } from './constants.js'
import { COLORS } from './theme.js'
import { Input } from './core/Input.js'
import { Shake } from './core/Shake.js'
import { SceneManager } from './core/SceneManager.js'
import { EventBus, EVENTS } from './core/EventBus.js'
import { AssetLoader } from './assets/AssetLoader.js'
import { MANIFEST } from './assets/manifest.js'
import { AudioSystem } from './systems/audio.js'
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
    this.events = new EventBus()
    this.assets = new AssetLoader()
    // SFX subscribes to the event bus; placeholder WebAudio synth until Step 4.
    this.audio = new AudioSystem(this.events, this.assets)
    // Asset loading progress for the boot loading screen. The game loop still
    // runs immediately (entities fall back to placeholders), but the React shell
    // holds a loading overlay over the canvas until `assetsReady` resolves, so
    // the player never sees sprites pop in. Images + SFX are counted together;
    // `onAssetProgress` is invoked with (loaded, total) as each unit settles.
    this.onAssetProgress = null
    this.assetProgress = { loaded: 0, total: 0 }
    this.assetsReady = this._loadAssets()
    this.floats = []
    this.lastDist = 0
    this.lastCoins = 0
    this.lastScore = 0
    this.safeTop = safeTop
    this.safeBottom = safeBottom

    // Game logic works in CSS pixels; ctx is pre-scaled to physical pixels.
    this.dpr = dpr
    this._applyDims()

    this._scenes = new SceneManager()
    // SceneManager doesn't know about the event bus; emit transitions here.
    this._scenes.onTransition = (name) => this.events.emit(EVENTS.SCENE_CHANGE, { scene: name })
    this._scenes
      .register('start', new StartScene(this))
      .register('play', new PlayScene(this))
      .register('gameover', new GameOverScene(this))

    this._last = null
    this.paused = false
    // Hit-stop (GDD §XIII): freeze the sim for a few ms on impact moments so a
    // near-miss "lands". The frozen frame keeps painting; updates are skipped
    // until the timer drains. Set via freezeFor().
    this._freeze = 0
    this._loop = this._loop.bind(this)
    this._scenes.go('start')
    this._raf = requestAnimationFrame(this._loop)
  }

  // Kick off image + SFX loading and aggregate both into one progress signal.
  // Resolves when everything is cached (or has errored — a failed unit still
  // counts so the bar can't stall). Entities/audio degrade gracefully meanwhile.
  async _loadAssets() {
    const imgTotal = AssetLoader.imageCount(MANIFEST)
    const { total: audioTotal, promise: audioDone } = this.audio.whenSfxLoaded(() => this._tickAsset())
    this.assetProgress = { loaded: 0, total: imgTotal + audioTotal }
    this.onAssetProgress?.(0, this.assetProgress.total)

    await Promise.all([this.assets.load(MANIFEST, () => this._tickAsset()), audioDone])
  }

  _tickAsset() {
    const p = this.assetProgress
    p.loaded = Math.min(p.total, p.loaded + 1)
    this.onAssetProgress?.(p.loaded, p.total)
  }

  // Recompute CSS-pixel dims + the floor line from the canvas size, and rescale
  // the context to the device pixel ratio. Used at construct and on resize.
  _applyDims() {
    this.width = Math.round(this.canvas.width / this.dpr)
    this.height = Math.round(this.canvas.height / this.dpr)
    this.scale = this.width / GAME_WIDTH
    this.floorY = Math.round(((GAME_HEIGHT - FLOOR_HEIGHT) / GAME_HEIGHT) * this.height)
    // Reset any prior transform, then scale so all draw calls use CSS pixels.
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(this.dpr, this.dpr)
  }

  // Re-fit when the frame size changes (desktop window resize / orientation).
  // The caller sets canvas.width/height first; we just recompute derived dims.
  resize(dpr = this.dpr) {
    this.dpr = dpr
    this._applyDims()
  }

  // Shared scene helper: a scene calls this to transition.
  go(name) {
    this._scenes.go(name)
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  // Freezes the simulation: the loop keeps running (so the frozen frame stays
  // painted) but no scene/float/shake update happens. Resuming clears _last so
  // the first post-resume frame doesn't integrate the whole paused duration as
  // one giant dt. Input edges are flushed on pause so a queued tap doesn't fire.
  setPaused(value) {
    const next = !!value
    if (next === this.paused) return
    this.paused = next
    if (!next) this._last = null // avoid a dt spike on resume
    this.input.flush()
    this.events.emit(EVENTS.PAUSE, { paused: next })
  }

  togglePause() {
    this.setPaused(!this.paused)
  }

  // Freeze the simulation for `seconds` (hit-stop). Multiple triggers in one
  // frame take the longest, so a near-miss during shake doesn't stack into a
  // visible hang. Capped to MAX_DT so a stray big value can't lock the game.
  freezeFor(seconds) {
    this._freeze = Math.min(MAX_DT, Math.max(this._freeze, seconds))
  }

  destroy() {
    cancelAnimationFrame(this._raf)
    this.input.destroy()
    this.audio.destroy()
    this.events.clear()
  }

  _loop(ts) {
    this._raf = requestAnimationFrame(this._loop)

    // While paused, keep painting the frozen frame but run no updates, so the
    // world holds still. We still redraw (cheap) so an overlay/resize stays clean.
    if (!this.paused) {
      const dt = this._last ? Math.min((ts - this._last) / 1000, MAX_DT) : 0.016
      this._last = ts

      // Hit-stop: while frozen, drain the timer but run no sim updates. Shake
      // still advances so the freeze + shake read as one punchy beat.
      this.shake.update(dt)
      if (this._freeze > 0) {
        this._freeze -= dt
      } else {
        this._scenes.update(dt)
        // In-place update + compaction: no new array per frame (GC), no copy
        // of survivors. Walk backward so splice doesn't shift unseen indices.
        const floats = this.floats
        for (let i = floats.length - 1; i >= 0; i--) {
          const f = floats[i]
          f.update(dt)
          if (f.dead()) floats.splice(i, 1)
        }
      }
    }

    // Draw (under shake transform)
    const ctx = this.ctx
    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)
    this._scenes.draw(ctx)
    const floats = this.floats
    for (let i = 0; i < floats.length; i++) floats[i].draw(ctx)
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
