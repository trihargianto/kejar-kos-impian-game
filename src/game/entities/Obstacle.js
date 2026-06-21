// ─── Obstacles ──────────────────────────────────────────────────────────────────
//
// Each def carries a `minKasta` (tier index) so SpawnDirector can grow the pool
// as the player advances kasta (GDD §VI). Tier 0 = Kipas Angin (tutorial-safe,
// all three verbs), 1 = AC Standar, 2 = Singgahsini, 3 = Kos Impian (everything).
import { GAME_HEIGHT, PLAYER_HEIGHT } from '../constants.js'
import { roundRect } from '../core/utils.js'

// Design-baseline sizes (at 390px width)
const SLIDE_CLEARANCE = 8

const OBS_DEFS = [
  {
    id: 'ember',
    zone: 'floor',
    minKasta: 0,
    w: 48,
    h: 48,
    fill: '#3498db',
    label: 'EMBER\n(JUMP)',
    getY: (floorY) => floorY - 48,
  },
  {
    id: 'kucing',
    zone: 'floor',
    minKasta: 0,
    w: 72,
    h: 40,
    fill: '#f39c12',
    label: 'KUCING\n(JUMP)',
    getY: (floorY) => floorY - 40,
  },
  {
    id: 'jemuran',
    zone: 'ceiling',
    minKasta: 0,
    w: 88,
    h: 36,
    fill: '#9b59b6',
    label: 'JEMURAN\n(SLIDE)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 36 - SLIDE_CLEARANCE,
  },
  {
    id: 'rak',
    zone: 'ceiling',
    minKasta: 0,
    w: 64,
    h: 52,
    fill: '#8e44ad',
    label: 'RAK\n(SLIDE)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 52 - SLIDE_CLEARANCE,
  },
  {
    id: 'pintu',
    zone: 'mid',
    minKasta: 0,
    w: 32,
    // Height proportional to screen — same ratio as design baseline (0.38 of GAME_HEIGHT)
    get h() {
      return Math.round(GAME_HEIGHT * 0.38)
    },
    fill: '#c0392b',
    label: 'PINTU\n(DASH)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - Math.round(GAME_HEIGHT * 0.38) - SLIDE_CLEARANCE,
  },
  // AC Standar additions (GDD §VI.2).
  {
    id: 'galon',
    zone: 'floor',
    minKasta: 1,
    w: 40,
    h: 64,
    fill: '#1abc9c',
    label: 'GALON\n(JUMP)',
    // "Moving" in the GDD = horizontal oscillation; placeholder keeps it static
    // for now, the oscillation is a Phase 2 visual polish on this same def.
    getY: (floorY) => floorY - 64,
  },
  {
    id: 'rak_sepatu',
    zone: 'ceiling',
    minKasta: 1,
    w: 70,
    h: 48,
    fill: '#6c3483',
    label: 'RAK SEPATU\n(SLIDE)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 48 - SLIDE_CLEARANCE,
  },
  // Singgahsini additions (GDD §VI.3).
  {
    id: 'monstera',
    zone: 'floor',
    minKasta: 2,
    w: 92,
    h: 80,
    fill: '#27ae60',
    label: 'MONSTERA\n(JUMP)',
    // "Visual blocker": wider footprint so it briefly hides oncoming traffic.
    getY: (floorY) => floorY - 80,
  },
]

// Kasta-twist obstacles, spawned by name (not in the random pool). Singgahsini's
// vacuum chases the floor lane and is read as a JUMP threat. The smart-lock is
// a mid-zone door that REQUIRES dash (GDD §VI.3 "smart-lock butuh dash"). Both
// injected by SpawnDirector when the active kasta's mechanic flag is on.
const SPECIAL_DEFS = {
  vacuum: {
    id: 'vacuum',
    zone: 'floor',
    w: 56,
    h: 26,
    fill: '#34495e',
    label: 'VACUUM\n(JUMP)',
    getY: (floorY) => floorY - 26,
  },
  smartlock: {
    id: 'smartlock',
    zone: 'mid',
    w: 36,
    get h() {
      return Math.round(GAME_HEIGHT * 0.42)
    },
    fill: '#2c3e50',
    label: 'SMART-LOCK\n(DASH)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - Math.round(GAME_HEIGHT * 0.42) - SLIDE_CLEARANCE,
  },
}

export class Obstacle {
  constructor(def, game) {
    const S = game.scale
    const floorY = game.floorY

    // Scale all dimensions
    this.w = Math.round(def.w * S)
    this.h = Math.round(def.h * S)
    // getY operates in design space, then we scale the result
    const designFloorY = floorY / S // convert runtime floorY back to design space for getY
    this.y = Math.round(def.getY(designFloorY) * S)
    this.x = game.width + this.w
    this.fill = def.fill
    this.label = def.label
    this.zone = def.zone
    this.passed = false
    this.nearMissed = false
    this._labelSize = Math.round(11 * S)
    this._labelLineH = Math.round(13 * S)
  }

  // Pick a random obstacle from the pool available at the given kasta tier.
  // `tier` is the active kasta index (0=Kipas Angin, 1=AC Standar, ...). defs
  // with minKasta ≤ tier are eligible. Defaults to 0 so uncalled uses still
  // return the tutorial-safe pool.
  static random(game, tier = 0) {
    const pool = OBS_DEFS.filter((d) => d.minKasta <= tier)
    const def = pool[Math.floor(Math.random() * pool.length)]
    return new Obstacle(def, game)
  }

  // Build a named kasta-twist obstacle (e.g. 'vacuum'). Returns null if unknown.
  static special(id, game) {
    const def = SPECIAL_DEFS[id]
    return def ? new Obstacle(def, game) : null
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  update(dt, speed) {
    this.x -= speed * dt
  }

  get offscreen() {
    return this.x + this.w < -100
  }

  draw(ctx) {
    ctx.fillStyle = this.fill
    roundRect(ctx, this.x, this.y, this.w, this.h, 4)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    roundRect(ctx, this.x, this.y + this.h - 5, this.w, 5, 4)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${this._labelSize}px monospace`
    ctx.textAlign = 'center'
    this.label.split('\n').forEach((line, i) => {
      ctx.fillText(
        line,
        this.x + this.w / 2,
        this.y + this.h / 2 - this._labelLineH / 2 + i * this._labelLineH
      )
    })
  }
}
