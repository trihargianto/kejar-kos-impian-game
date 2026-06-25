// ─── Audio system ─────────────────────────────────────────────────────────────
// Placeholder SFX via the WebAudio API — no asset files yet (Step 4 swaps in
// real recorded sounds through AssetLoader). Subscribes to the EventBus so
// gameplay code stays audio-agnostic: emit an event, the right blip plays.
//
// Browsers block audio until a user gesture, so the context is created lazily
// and resumed on the first input event. Everything degrades to silence if
// WebAudio is unavailable (SSR, tests, locked-down browsers).
//
// Map (GDD §XIV): jump "Hup", hit "ember jatuh", near-miss pitch-up per combo,
// game-over sad tone, 1000m sirine. Synth approximations until real SFX land.
import { EVENTS } from '../core/EventBus.js'
import { loadSettings } from './settings.js'

export class AudioSystem {
  constructor(events, assets = null) {
    this.events = events
    this.assets = assets
    this.ctx = null
    this._offs = []
    // Initial SFX on/off from saved settings.
    this.enabled = loadSettings().sfx
    this._wire()
  }

  // Lazily build the AudioContext (must follow a user gesture).
  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return this.ctx
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      return this.ctx
    } catch {
      this.enabled = false
      return null
    }
  }


  // One short tone. freq Hz, dur seconds, type oscillator wave, gain 0..1.
  _tone(freq, dur = 0.12, type = 'square', gain = 0.18, slideTo = null) {
    if (!this.enabled) return
    const ctx = this._ensure()
    if (!ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(env).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  // Play a pre-loaded audio asset by id. Falls back to nothing if missing.
  _playSample(id, volume = 1) {
    if (!this.enabled) return
    const el = this.assets?.audio(id)
    if (!el) return
    try {
      const clone = el.cloneNode()
      clone.volume = volume
      clone.play().catch(() => {})
    } catch {
      // ignore
    }
  }

  // Schedule a tone to start at an absolute AudioContext time (for fanfares).
  _toneAt(startAt, freq, dur = 0.12, type = 'square', gain = 0.18, slideTo = null) {
    if (!this.enabled) return
    const ctx = this._ensure()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, startAt)
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, startAt + dur)
    env.gain.setValueAtTime(0.0001, startAt)
    env.gain.exponentialRampToValueAtTime(gain, startAt + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + dur)
    osc.connect(env).connect(ctx.destination)
    osc.start(startAt)
    osc.stop(startAt + dur + 0.02)
  }

  // Noise burst — for the "ember jatuh" hit thud.
  _noise(dur = 0.18, gain = 0.22) {
    if (!this.enabled) return
    const ctx = this._ensure()
    if (!ctx) return
    const frames = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = ctx.createBufferSource()
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, ctx.currentTime)
    env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    src.buffer = buf
    src.connect(env).connect(ctx.destination)
    src.start()
  }

  _wire() {
    const E = this.events
    const sub = (evt, fn) => this._offs.push(E.on(evt, fn))

    sub(EVENTS.GAME_START, () => this._tone(140, 0.18, 'square', 0.2, 90)) // gedor pintu-ish thud
    sub(EVENTS.PLAYER_JUMP, () => {
      this._playSample('sfx:jump', 0.7)
    })

    sub(EVENTS.PLAYER_SLIDE, () => this._playSample('sfx:slide', 0.75))
    sub(EVENTS.PLAYER_DASH, () => this._playSample('sfx:dash', 0.75))
    sub(EVENTS.PLAYER_HIT, () => this._playSample('sfx:hit', 0.9))
    sub(EVENTS.COLLECT_COIN, () => this._playSample('sfx:coin', 0.7))

    // Power-ups (GDD §VII). Kopi pickup = warm rising chord; sandal pickup =
    // short bright blip. Throw = percussive thwack; boost start = zoom-up tone.
    sub(EVENTS.COLLECT_HEART, () => {
      // Rising triad: bright & celebratory, distinct from kopi's lower chord.
      this._tone(523, 0.12, 'triangle', 0.17, 784)
      this._tone(784, 0.18, 'triangle', 0.15, 1047)
    })
    const KOPI_SFX = [
      'sfx:kopi_1', // mlg-air-horn
      'sfx:kopi_2', // oh-my-god
      'sfx:kopi_3', // wow-anime
      'sfx:kopi_4', // yeah-boiii
    ]
    sub(EVENTS.COLLECT_KOPI, () => {
      const id = KOPI_SFX[Math.floor(Math.random() * KOPI_SFX.length)]
      this._playSample(id, 0.75)
    })
    sub(EVENTS.COLLECT_SANDAL, () => this._tone(740, 0.12, 'square', 0.16, 980))
    sub(EVENTS.SANDAL_THROW, () => this._playSample('sfx:punch', 0.85))
    sub(EVENTS.DOOR_BREAK, () => this._playSample('sfx:crash', 0.8))
    // Out of ammo — dry click (low square blip, no slide).
    sub(EVENTS.SANDAL_EMPTY, () => this._tone(180, 0.07, 'square', 0.1))
    sub(EVENTS.BOOST_START, () => this._tone(220, 0.4, 'sawtooth', 0.16, 660))
    // Boost winding down — descending tone mirrors the start's rising one.
    sub(EVENTS.BOOST_END, () => {
      this._tone(660, 0.25, 'sawtooth', 0.14, 220)
    })

    sub(EVENTS.KOPI_SMASH, () => this._playSample('sfx:punch', 0.85))

    // Near-miss: pitch climbs with combo (capped so it stays musical).
    sub(EVENTS.NEAR_MISS, ({ combo = 1 } = {}) => {
      const semis = Math.min(combo, 12)
      this._tone(440 * Math.pow(2, semis / 12), 0.1, 'square', 0.15)
    })

    // Combo milestone ticks — every 5th combo a brighter blip so the player
    // hears the chain building (distinct from near-miss pitch-up).
    sub(EVENTS.COMBO_GAIN, ({ combo = 1 } = {}) => {
      if (combo > 0 && combo % 5 === 0) {
        this._tone(1200, 0.06, 'triangle', 0.12, 1600)
      }
    })

    sub(EVENTS.PLAYER_DEATH, () => {
      this._tone(330, 0.25, 'triangle', 0.18, 160)
      this._tone(196, 0.4, 'triangle', 0.16, 110)
    })

    // New record fanfare — three rising notes after the death tones settle.
    sub(EVENTS.GAME_OVER, ({ isNewRecord } = {}) => {
      if (!isNewRecord) return
      const ctx = this._ensure()
      if (!ctx) return
      const t = ctx.currentTime + 0.55 // let death tones finish first
      this._toneAt(t + 0.0, 523, 0.12, 'triangle', 0.18, 659)
      this._toneAt(t + 0.14, 659, 0.12, 'triangle', 0.18, 784)
      this._toneAt(t + 0.28, 784, 0.22, 'triangle', 0.22, 1047)
    })

    // 1000m → Mode Kos Impian: a two-tone sirine (meteran listrik).
    sub(EVENTS.KASTA_UP, ({ id } = {}) => {
      if (id === 'kos_impian') {
        this._tone(740, 0.25, 'sawtooth', 0.18, 980)
        this._tone(980, 0.25, 'sawtooth', 0.18, 740)
      } else {
        this._tone(620, 0.16, 'triangle', 0.16, 820)
      }
    })

    // UI — real pop SFX for menu taps (falls back to synth if asset missing).
    sub(EVENTS.MENU_TAP, () => this._playSample('sfx:menu_tap', 0.8))

    // Home screen music: start on entering start scene, stop on game start.
    sub(EVENTS.SCENE_CHANGE, ({ scene } = {}) => {
      if (scene === 'start') this._musicPlay('music:home')
      else this._musicStop()
    })
  }

  _musicPlay(id) {
    if (this._music) this._musicStop()
    const el = this.assets?.audio(id)
    if (!el) return
    const m = el.cloneNode()
    m.loop = true
    m.volume = this.enabled ? 0.45 : 0
    m.play().catch(() => {})
    this._music = m
    this._musicId = id
  }

  _musicStop() {
    if (!this._music) return
    this._music.pause()
    this._music.currentTime = 0
    this._music = null
    this._musicId = null
  }

  setEnabled(on) {
    this.enabled = !!on
    if (this._music) this._music.volume = on ? 0.45 : 0
  }

  destroy() {
    this._offs.forEach((off) => off())
    this._offs = []
    this._musicStop()
    try {
      this.ctx?.close()
    } catch {
      // ignore
    }
  }
}
