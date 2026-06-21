// ─── Obstacles ──────────────────────────────────────────────────────────────────
// Data-driven catalogue plus a lightweight runtime instance. Add an entry to
// OBS_TYPES to introduce a new obstacle — no other code needs to change.
import { GAME_WIDTH, GAME_HEIGHT, FLOOR_Y, PLAYER_HEIGHT } from '../constants.js'
import { roundRect } from '../core/utils.js'

const PINTU_HEIGHT = Math.round(GAME_HEIGHT * 0.38)
const SLIDE_CLEARANCE = 8 // px gap above the sliding hitbox for ceiling obstacles

export const OBS_TYPES = [
  {
    id: 'ember',
    zone: 'floor',
    w: 32,
    h: 32,
    fill: '#3498db',
    label: 'EMBER\n(JUMP)',
    getY: () => FLOOR_Y - 32,
  },
  {
    id: 'kucing',
    zone: 'floor',
    w: 52,
    h: 26,
    fill: '#f39c12',
    label: 'KUCING\n(JUMP)',
    getY: () => FLOOR_Y - 26,
  },
  {
    id: 'jemuran',
    zone: 'ceiling',
    w: 64,
    h: 22,
    fill: '#9b59b6',
    label: 'JEMURAN\n(SLIDE)',
    // Bottom must clear the slide hitbox top (FLOOR_Y - PLAYER_HEIGHT/2).
    getY: () => FLOOR_Y - PLAYER_HEIGHT / 2 - 22 - SLIDE_CLEARANCE,
  },
  {
    id: 'rak',
    zone: 'ceiling',
    w: 46,
    h: 34,
    fill: '#8e44ad',
    label: 'RAK\n(SLIDE)',
    getY: () => FLOOR_Y - PLAYER_HEIGHT / 2 - 34 - SLIDE_CLEARANCE,
  },
  {
    id: 'pintu',
    zone: 'mid',
    w: 20,
    h: PINTU_HEIGHT,
    fill: '#c0392b',
    label: 'PINTU\n(DASH)',
    getY: () => FLOOR_Y - PINTU_HEIGHT - 30,
  },
]

export class Obstacle {
  constructor(type) {
    this.x = GAME_WIDTH + type.w
    this.y = type.getY()
    this.w = type.w
    this.h = type.h
    this.fill = type.fill
    this.label = type.label
    this.zone = type.zone
    this.passed = false
    this.nearMissed = false
  }

  static random() {
    const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)]
    return new Obstacle(type)
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  update(dt, speed) {
    this.x -= speed * dt
  }

  // Off-screen far enough to recycle.
  get offscreen() {
    return this.x + this.w < -100
  }

  draw(ctx) {
    ctx.fillStyle = this.fill
    roundRect(ctx, this.x, this.y, this.w, this.h, 4)
    // Bottom shadow band
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    roundRect(ctx, this.x, this.y + this.h - 5, this.w, 5, 4)
    // Label
    ctx.fillStyle = '#fff'
    ctx.font = '8px monospace'
    ctx.textAlign = 'center'
    this.label.split('\n').forEach((line, i) => {
      ctx.fillText(line, this.x + this.w / 2, this.y + this.h / 2 - 4 + i * 10)
    })
  }
}
