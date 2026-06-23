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
  constructor(events) {
    this.events = events
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

  // Live SFX toggle from the Settings panel.
  setEnabled(on) {
    this.enabled = !!on
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
    sub(EVENTS.PLAYER_JUMP, () => this._tone(520, 0.1, 'square', 0.16, 760)) // "Hup!"
    sub(EVENTS.PLAYER_SLIDE, () => this._tone(300, 0.14, 'sawtooth', 0.14, 180))
    sub(EVENTS.PLAYER_DASH, () => this._tone(220, 0.16, 'sawtooth', 0.16, 660))
    sub(EVENTS.PLAYER_HIT, () => this._noise(0.2, 0.24)) // ember jatuh
    sub(EVENTS.COLLECT_COIN, () => this._tone(880, 0.08, 'triangle', 0.14, 1180))

    // Power-ups (GDD §VII). Kopi pickup = warm rising chord; sandal pickup =
    // short bright blip. Throw = percussive thwack; boost start = zoom-up tone.
    sub(EVENTS.COLLECT_KOPI, () => {
      this._tone(440, 0.18, 'triangle', 0.18, 660)
      this._tone(660, 0.18, 'triangle', 0.16, 880)
    })
    sub(EVENTS.COLLECT_SANDAL, () => this._tone(740, 0.12, 'square', 0.16, 980))
    sub(EVENTS.SANDAL_THROW, () => this._noise(0.1, 0.18))
    sub(EVENTS.BOOST_START, () => this._tone(220, 0.4, 'sawtooth', 0.16, 660))

    // Near-miss: pitch climbs with combo (capped so it stays musical).
    sub(EVENTS.NEAR_MISS, ({ combo = 1 } = {}) => {
      const semis = Math.min(combo, 12)
      this._tone(440 * Math.pow(2, semis / 12), 0.1, 'square', 0.15)
    })

    sub(EVENTS.PLAYER_DEATH, () => {
      this._tone(330, 0.25, 'triangle', 0.18, 160)
      this._tone(196, 0.4, 'triangle', 0.16, 110)
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
  }

  destroy() {
    this._offs.forEach((off) => off())
    this._offs = []
    try {
      this.ctx?.close()
    } catch {
      // ignore
    }
  }
}
