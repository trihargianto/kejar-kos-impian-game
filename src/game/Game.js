import {
  GAME_WIDTH,
  GAME_HEIGHT,
  FLOOR_Y,
  PLAYER_X,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  SLIDE_DURATION,
  DASH_VELOCITY,
  DASH_DURATION,
  DASH_COOLDOWN,
  BASE_SPEED,
  SPEED_RAMP,
  NEAR_MISS_DISTANCE,
  COMBO_DECAY_TIME,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_MAX,
  KASTA_AC_THRESHOLD,
  KASTA_SINGGAH_THRESHOLD,
  KASTA_IMPIAN_THRESHOLD,
} from './constants.js'
import { Input, Shake } from './engine.js'

// ─── Obstacle catalogue ────────────────────────────────────────────────────
const OBS_TYPES = [
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
    // Bottom of obstacle must be above slide hitbox top (FLOOR_Y - PLAYER_H/2)
    // jemuran h=22, so getY must be <= FLOOR_Y - PLAYER_H/2 - 22 - clearance
    getY: () => FLOOR_Y - PLAYER_H / 2 - 22 - 8,
  },
  {
    id: 'rak',
    zone: 'ceiling',
    w: 46,
    h: 34,
    fill: '#8e44ad',
    label: 'RAK\n(SLIDE)',
    getY: () => FLOOR_Y - PLAYER_H / 2 - 34 - 8,
  },
  {
    id: 'pintu',
    zone: 'mid',
    w: 20,
    h: Math.round(GAME_H * 0.38),
    fill: '#c0392b',
    label: 'PINTU\n(DASH)',
    getY: () => FLOOR_Y - Math.round(GAME_H * 0.38) - 30,
  },
]

// ─── Floating text ──────────────────────────────────────────────────────────
class FloatText {
  constructor(text, x, y, color = '#f1c40f', size = 20) {
    this.text = text
    this.x = x
    this.y = y
    this.color = color
    this.size = size
    this.life = 1.0
    this.maxLife = 1.0
  }
  update(dt) {
    this.life -= dt
    this.y -= 60 * dt
  }
  dead() {
    return this.life <= 0
  }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife)
    ctx.fillStyle = this.color
    ctx.font = `bold ${this.size}px monospace`
    ctx.textAlign = 'center'
    const lines = this.text.split('\n')
    lines.forEach((l, i) => ctx.fillText(l, this.x, this.y + i * (this.size + 2)))
    ctx.restore()
  }
}

// ─── Main Game class ─────────────────────────────────────────────────────────
export class Game {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.input = new Input(canvas)
    this.shake = new Shake()
    this.state = 'start' // start | play | gameover
    this._raf = null
    this._last = null
    this.floats = []
    this._initPlay()
    this._loop = this._loop.bind(this)
    this._raf = requestAnimationFrame(this._loop)
  }

  // ── Init / reset play state ────────────────────────────────────────────────
  _initPlay() {
    this.dist = 0
    this.spd = BASE_SPD
    this.lives = 3
    this.combo = 0
    this.mult = 1
    this.lastNear = -999
    this.alive = true

    // Player
    this.px = PLAYER_X
    this.py = FLOOR_Y - PLAYER_H
    this.pvy = 0 // vertical velocity
    this.grounded = false
    this.jumps = 2
    this.sliding = false
    this.slideTimer = 0
    this.dashing = false
    this.dashTimer = 0
    this.dashCd = 0
    this.invTimer = 0

    // Obstacles
    this.obs = []
    this.spawnTimer = lerp(SPAWN_MIN, SPAWN_MAX, Math.random())

    this.floats = []
    this.gameoverDist = 0
  }

  destroy() {
    cancelAnimationFrame(this._raf)
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  _loop(ts) {
    this._raf = requestAnimationFrame(this._loop)
    const dt = this._last ? Math.min((ts - this._last) / 1000, 0.05) : 0.016
    this._last = ts

    this._update(dt)
    this._draw()
    this.input.flush()
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  _update(dt) {
    this.shake.update(dt)

    if (this.state === 'start') {
      this._updateStart()
    } else if (this.state === 'play') {
      this._updatePlay(dt)
    } else if (this.state === 'gameover') {
      this._updateGameover()
    }

    this.floats.forEach((f) => f.update(dt))
    this.floats = this.floats.filter((f) => !f.dead())
  }

  _updateStart() {
    if (this._actionPressed()) {
      this._initPlay()
      this.state = 'play'
    }
  }

  _updateGameover() {
    if (this._actionPressed()) {
      this._initPlay()
      this.state = 'play'
    }
  }

  _updatePlay(dt) {
    if (!this.alive) return

    // Speed ramp
    this.spd = BASE_SPD + (this.dist / 10) * SPD_RAMP
    this.dist += (this.spd / 200) * dt

    // ── Input ────────────────────────────────────────────────────────────────
    const jumpPress =
      this.input.justPressed('Space') ||
      this.input.justPressed('ArrowUp') ||
      this.input.justPressed('KeyW') ||
      this.input.justPressed('Tap')

    const slidePress =
      this.input.justPressed('ArrowDown') ||
      this.input.justPressed('KeyS') ||
      this.input.justPressed('SwipeDown')

    const dashPress =
      this.input.justPressed('ShiftLeft') ||
      this.input.justPressed('ShiftRight') ||
      this.input.justPressed('ArrowRight') ||
      this.input.justPressed('SwipeRight')

    if (jumpPress) this._doJump()
    if (slidePress) this._doSlide()
    if (dashPress) this._doDash()

    // ── Physics ──────────────────────────────────────────────────────────────
    this.pvy += GRAVITY * dt
    this.py += this.pvy * dt

    // Floor collision
    const curH = this.sliding ? PLAYER_H / 2 : PLAYER_H
    const floorTop = FLOOR_Y - curH
    if (this.py >= floorTop) {
      this.py = floorTop
      this.pvy = 0
      this.grounded = true
      this.jumps = 2
    } else {
      this.grounded = false
    }

    // ── Slide ────────────────────────────────────────────────────────────────
    if (this.sliding) {
      this.slideTimer -= dt
      if (this.slideTimer <= 0) this.sliding = false
    }

    // ── Dash ─────────────────────────────────────────────────────────────────
    if (this.dashing) {
      this.dashTimer -= dt
      this.px = Math.min(GAME_W - PLAYER_W - 20, this.px + DASH_VEL * dt)
      if (this.dashTimer <= 0) {
        this.dashing = false
        // Animate back
        this._dashReturnFrom = this.px
        this._dashReturnTimer = 0.22
      }
    }
    if (this._dashReturnTimer > 0) {
      this._dashReturnTimer -= dt
      const t = 1 - Math.max(0, this._dashReturnTimer / 0.22)
      this.px = lerp(this._dashReturnFrom, PLAYER_X, easeOut(t))
      if (this._dashReturnTimer <= 0) this.px = PLAYER_X
    }

    if (this.dashCd > 0) this.dashCd -= dt

    // ── Invincible ───────────────────────────────────────────────────────────
    if (this.invTimer > 0) this.invTimer -= dt

    // ── Obstacles ────────────────────────────────────────────────────────────
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this._spawnObs()
      const base = lerp(SPAWN_MIN, SPAWN_MAX, Math.random())
      this.spawnTimer = Math.max(0.5, base - this.dist * 0.00012)
    }

    const playerRight = this.px + PLAYER_W
    const playerTop = this.py
    const playerBot = this.py + (this.sliding ? PLAYER_H / 2 : PLAYER_H)

    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i]
      o.x -= this.spd * dt

      // Near-miss check (before collision to give credit)
      if (!o.passed && !o.nearMissed) {
        const gap = o.x - playerRight
        if (gap >= 0 && gap < NEAR_MISS_PX) {
          o.nearMissed = true
          this._onNearMiss()
        } else if (gap < 0 && o.x + o.w < PLAYER_X - NEAR_MISS_PX * 2) {
          o.passed = true
        }
      }

      // Collision (AABB)
      if (this.invTimer <= 0) {
        const obsRight = o.x + o.w
        const obsBot = o.y + o.h
        const overlaps =
          obsRight > this.px && o.x < playerRight && obsBot > playerTop && o.y < playerBot

        if (overlaps) {
          if ((this.dashing || this._dashReturnTimer > 0) && o.zone === 'mid') {
            // Dash through — no damage (exempt during both dash burst and snap-back)
          } else {
            this._takeDamage()
          }
        }
      }

      if (o.x + o.w < -100) this.obs.splice(i, 1)
    }

    // ── Combo decay ──────────────────────────────────────────────────────────
    if (this.combo > 0 && performance.now() / 1000 - this.lastNear > COMBO_DECAY) {
      this.combo = 0
      this.mult = 1
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  _doJump() {
    if (this.sliding) {
      this.sliding = false
      return
    }
    if (this.jumps <= 0) return
    this.pvy = this.jumps === 2 ? JUMP_VEL : DOUBLE_JUMP_VEL
    this.jumps--
    this.grounded = false
    // Tiny jump puff
    this.floats.push(new FloatText('↑', this.px + PLAYER_W / 2, this.py - 4, '#fff', 14))
  }

  _doSlide() {
    if (!this.grounded || this.sliding) return
    this.sliding = true
    this.slideTimer = SLIDE_DUR
    this.floats.push(new FloatText('SLIDE!', this.px + PLAYER_W / 2, this.py - 16, '#9b59b6', 16))
  }

  _doDash() {
    if (this.dashing || this.dashCd > 0) return
    this.dashing = true
    this.dashTimer = DASH_DUR
    this.dashCd = DASH_CD
    this._dashReturnTimer = 0
    this.floats.push(new FloatText('DASH!', this.px + 50, this.py + 10, '#e67e22', 16))
  }

  _onNearMiss() {
    this.combo++
    this.mult = Math.min(Math.pow(2, Math.floor(this.combo / 2)), 32)
    this.lastNear = performance.now() / 1000
    const txts = ['Nyaris!', 'GILA!', 'DPO!']
    const t = this.combo <= 2 ? txts[0] : this.combo <= 6 ? txts[1] : txts[2]
    this.floats.push(new FloatText(t, this.px + PLAYER_W / 2, this.py - 40, '#f1c40f', 22))
    this.shake.trigger(5, 0.18)
  }

  _takeDamage() {
    this.lives--
    this.combo = 0
    this.mult = 1
    this.invTimer = 1.5
    this.shake.trigger(12, 0.3)
    this.floats.push(new FloatText('AW!', this.px + PLAYER_W / 2, this.py - 20, '#e74c3c', 20))
    if (this.lives <= 0) {
      this.alive = false
      this.gameoverDist = Math.floor(this.dist)
      setTimeout(() => {
        this.state = 'gameover'
      }, 700)
    }
  }

  _spawnObs() {
    const t = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)]
    this.obs.push({
      x: GAME_W + t.w,
      y: t.getY(),
      w: t.w,
      h: t.h,
      fill: t.fill,
      label: t.label,
      zone: t.zone,
      passed: false,
      nearMissed: false,
    })
  }

  _actionPressed() {
    return (
      this.input.justPressed('Space') ||
      this.input.justPressed('Enter') ||
      this.input.justPressed('Tap') ||
      this.input.justPressed('ArrowUp')
    )
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx
    const off = this.shake.offset()
    ctx.save()
    ctx.translate(off.x, off.y)

    if (this.state === 'start') {
      this._drawStart(ctx)
    } else if (this.state === 'play') {
      this._drawPlay(ctx)
    } else if (this.state === 'gameover') {
      this._drawGameover(ctx)
    }

    // Floating texts always on top
    this.floats.forEach((f) => f.draw(ctx))

    ctx.restore()
  }

  _drawStart(ctx) {
    // BG
    ctx.fillStyle = '#e8d5b0'
    ctx.fillRect(0, 0, GAME_W, GAME_H)
    this._drawFloor(ctx)

    // Title
    ctx.fillStyle = '#222'
    ctx.font = 'bold 48px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('KEJAR KOS', GAME_W / 2, GAME_H * 0.22)
    ctx.fillText('IMPIAN', GAME_W / 2, GAME_H * 0.22 + 56)

    // Subtitle
    ctx.font = '15px sans-serif'
    ctx.fillStyle = '#555'
    ctx.fillText('Tanggal tua, dompet kering,', GAME_W / 2, GAME_H * 0.44)
    ctx.fillText('Ibu Kos gedor pintu...', GAME_W / 2, GAME_H * 0.44 + 22)
    ctx.fillText('Kabur ke kos impian!', GAME_W / 2, GAME_H * 0.44 + 44)

    // CTA
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400)
    ctx.globalAlpha = pulse
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 22px sans-serif'
    ctx.fillText('TAP / SPASI untuk mulai', GAME_W / 2, GAME_H * 0.68)
    ctx.globalAlpha = 1

    // Controls
    ctx.font = '13px monospace'
    ctx.fillStyle = '#777'
    ctx.fillText('TAP = Lompat', GAME_W / 2, GAME_H * 0.8)
    ctx.fillText('SWIPE ↓ = Slide', GAME_W / 2, GAME_H * 0.8 + 20)
    ctx.fillText('SWIPE → = Dash', GAME_W / 2, GAME_H * 0.8 + 40)
  }

  _drawPlay(ctx) {
    // BG color per kasta
    const kasta = getKasta(this.dist)
    ctx.fillStyle = kastaBg(kasta)
    ctx.fillRect(0, 0, GAME_W, GAME_H)

    // Scrolling floor stripe (parallax feel)
    this._drawFloor(ctx)

    // Obstacles
    this.obs.forEach((o) => {
      ctx.fillStyle = o.fill
      roundRect(ctx, o.x, o.y, o.w, o.h, 4)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      roundRect(ctx, o.x, o.y + o.h - 5, o.w, 5, 4)
      // Label
      ctx.fillStyle = '#fff'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      const lines = o.label.split('\n')
      lines.forEach((l, i) => ctx.fillText(l, o.x + o.w / 2, o.y + o.h / 2 - 4 + i * 10))
    })

    // Player
    const curH = this.sliding ? PLAYER_H / 2 : PLAYER_H
    const playerY = this.sliding ? FLOOR_Y - PLAYER_H / 2 : this.py
    const showPlayer = this.invTimer <= 0 || Math.floor(this.invTimer * 12) % 2 === 0

    if (showPlayer) {
      // Body
      ctx.fillStyle = '#e74c3c'
      roundRect(ctx, this.px, playerY, PLAYER_W, curH, 5)
      // Eyes
      if (!this.sliding) {
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(this.px + PLAYER_W * 0.65, playerY + 14, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#222'
        ctx.beginPath()
        ctx.arc(this.px + PLAYER_W * 0.65 + 1.5, playerY + 15, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // Dash trail
      if (this.dashing) {
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = `rgba(231,76,60,${0.3 - i * 0.08})`
          roundRect(ctx, this.px - i * 14, playerY + 4, PLAYER_W, curH - 8, 5)
        }
      }
    }

    // Label above player
    ctx.fillStyle = '#222'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ANAK KOS', this.px + PLAYER_W / 2, this.py - 6)

    // ── HUD ──────────────────────────────────────────────────────────────────
    // Distance + multiplier
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.floor(this.dist)}m  ×${this.mult}`, GAME_W / 2, 28)

    // Lives (hearts)
    ctx.font = '22px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, 3 - this.lives)), 12, 30)

    // Combo
    if (this.combo > 0) {
      ctx.fillStyle = '#e74c3c'
      ctx.font = 'bold 15px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`COMBO x${this.combo}  ×${this.mult}`, GAME_W / 2, 54)
    }

    // Kasta label
    ctx.fillStyle = '#555'
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`KASTA: ${kasta}`, 12, GAME_H - 36)

    // Dash indicator
    ctx.textAlign = 'right'
    if (this.dashCd > 0) {
      ctx.fillStyle = '#e74c3c'
      ctx.fillText(`DASH: ${this.dashCd.toFixed(1)}s`, GAME_W - 12, GAME_H - 36)
    } else {
      ctx.fillStyle = '#27ae60'
      ctx.fillText('DASH: READY', GAME_W - 12, GAME_H - 36)
    }

    // Controls hint
    ctx.fillStyle = '#aaa'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('TAP=Lompat  ↓=Slide  →=Dash', GAME_W / 2, GAME_H - 14)
  }

  _drawGameover(ctx) {
    // Dim overlay
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, GAME_W, GAME_H)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 44px monospace'
    ctx.fillText('GAME OVER', GAME_W / 2, GAME_H * 0.28)

    ctx.fillStyle = '#f1c40f'
    ctx.font = 'bold 28px monospace'
    ctx.fillText(`${this.gameoverDist}m`, GAME_W / 2, GAME_H * 0.42)

    const rank = getRank(this.gameoverDist)
    ctx.fillStyle = '#eee'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(rank, GAME_W / 2, GAME_H * 0.52)

    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 400)
    ctx.globalAlpha = pulse
    ctx.fillStyle = '#fff'
    ctx.font = '18px sans-serif'
    ctx.fillText('Tap / Spasi untuk coba lagi', GAME_W / 2, GAME_H * 0.7)
    ctx.globalAlpha = 1
  }

  _drawFloor(ctx) {
    // Floor fill
    ctx.fillStyle = '#8b6914'
    ctx.fillRect(0, FLOOR_Y, GAME_W, GAME_H - FLOOR_Y)
    // Floor line
    ctx.fillStyle = '#5a4010'
    ctx.fillRect(0, FLOOR_Y, GAME_W, 4)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}
function easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}

function roundRect(ctx, x, y, w, h, r = 0) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function getKasta(dist) {
  if (dist < KASTA_AC) return 'KIPAS ANGIN'
  if (dist < KASTA_SINGGAH) return 'AC STANDAR'
  if (dist < KASTA_IMPIAN) return 'SINGGAHSINI'
  return 'KOS IMPIAN'
}

function kastaBg(kasta) {
  if (kasta === 'KIPAS ANGIN') return '#e8d5b0'
  if (kasta === 'AC STANDAR') return '#d4ecd4'
  if (kasta === 'SINGGAHSINI') return '#d4e4f0'
  return '#ede0ff'
}

function getRank(dist) {
  if (dist < 100) return '🥴 Buronan Kelas Teri'
  if (dist < 500) return '😤 Suhu Tanggal Tua'
  if (dist < 1000) return '🔥 Buronan Kelas Kakap'
  return '🏆 Legenda Kos-Kosan'
}
