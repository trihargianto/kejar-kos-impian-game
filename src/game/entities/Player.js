// ─── Player ───────────────────────────────────────────────────────────────────
// The runner. Owns its kinematic state, movement actions, and rendering.
// The runner is fixed horizontally (PLAYER_X) except during a dash burst and the
// subsequent snap-back animation.
import {
  GAME_WIDTH,
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
} from '../constants.js'
import { COLORS } from '../theme.js'
import { lerp, easeOut, roundRect } from '../core/utils.js'

const DASH_RIGHT_MARGIN = 20 // px the dash stops short of the right wall
const SNAP_BACK_TIME = 0.22 // seconds to glide back to PLAYER_X after a dash

export class Player {
  constructor() {
    this.reset()
  }

  reset() {
    this.x = PLAYER_X
    this.y = FLOOR_Y - PLAYER_HEIGHT
    this.vy = 0
    this.grounded = false
    this.jumps = 2
    this.sliding = false
    this.slideTimer = 0
    this.dashing = false
    this.dashTimer = 0
    this.dashCd = 0
    this.invTimer = 0
    this._snapFrom = 0
    this._snapTimer = 0
  }

  // Current collision height (halved while sliding).
  get height() {
    return this.sliding ? PLAYER_HEIGHT / 2 : PLAYER_HEIGHT
  }

  // Live collision box {x, y, w, h}.
  get bounds() {
    return { x: this.x, y: this.y, w: PLAYER_WIDTH, h: this.height }
  }

  get invincible() {
    return this.invTimer > 0
  }

  // True while gliding backward after a dash — immune to all obstacles.
  get snappingBack() {
    return this._snapTimer > 0
  }

  // ── Actions (return a list of {text,x,y,color,size} float requests) ───────────
  jump() {
    if (this.sliding) {
      this.sliding = false
      return []
    }
    if (this.jumps <= 0) return []
    this.vy = this.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY
    this.jumps--
    this.grounded = false
    return [
      { text: '↑', x: this.x + PLAYER_WIDTH / 2, y: this.y - 4, color: COLORS.white, size: 14 },
    ]
  }

  slide() {
    if (!this.grounded || this.sliding) return []
    this.sliding = true
    this.slideTimer = SLIDE_DURATION
    return [
      { text: 'SLIDE!', x: this.x + PLAYER_WIDTH / 2, y: this.y - 16, color: '#9b59b6', size: 16 },
    ]
  }

  dash() {
    if (this.dashing || this.dashCd > 0) return []
    this.dashing = true
    this.dashTimer = DASH_DURATION
    this.dashCd = DASH_COOLDOWN
    this._snapTimer = 0
    return [{ text: 'DASH!', x: this.x + 50, y: this.y + 10, color: '#e67e22', size: 16 }]
  }

  hit(invDuration) {
    this.invTimer = invDuration
  }

  // ── Physics ───────────────────────────────────────────────────────────────────
  update(dt) {
    // Gravity + vertical integration
    this.vy += GRAVITY * dt
    this.y += this.vy * dt

    // Floor collision
    const floorTop = FLOOR_Y - this.height
    if (this.y >= floorTop) {
      this.y = floorTop
      this.vy = 0
      this.grounded = true
      this.jumps = 2
    } else {
      this.grounded = false
    }

    // Slide timer
    if (this.sliding) {
      this.slideTimer -= dt
      if (this.slideTimer <= 0) this.sliding = false
    }

    // Dash burst
    if (this.dashing) {
      this.x = Math.min(GAME_WIDTH - PLAYER_WIDTH - DASH_RIGHT_MARGIN, this.x + DASH_VELOCITY * dt)
      this.dashTimer -= dt
      if (this.dashTimer <= 0) {
        this.dashing = false
        this._snapFrom = this.x
        this._snapTimer = SNAP_BACK_TIME
      }
    }

    // Snap back to home X
    if (this._snapTimer > 0) {
      this._snapTimer -= dt
      const t = 1 - Math.max(0, this._snapTimer / SNAP_BACK_TIME)
      this.x = lerp(this._snapFrom, PLAYER_X, easeOut(t))
      if (this._snapTimer <= 0) this.x = PLAYER_X
    }

    if (this.dashCd > 0) this.dashCd -= dt
    if (this.invTimer > 0) this.invTimer -= dt
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  draw(ctx) {
    const h = this.height
    const drawY = this.sliding ? FLOOR_Y - PLAYER_HEIGHT / 2 : this.y
    const visible = this.invTimer <= 0 || Math.floor(this.invTimer * 12) % 2 === 0

    if (visible) {
      // Body
      ctx.fillStyle = COLORS.player
      roundRect(ctx, this.x, drawY, PLAYER_WIDTH, h, 5)
      // Eyes (hidden while sliding)
      if (!this.sliding) {
        ctx.fillStyle = COLORS.playerEye
        ctx.beginPath()
        ctx.arc(this.x + PLAYER_WIDTH * 0.65, drawY + 14, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLORS.playerPupil
        ctx.beginPath()
        ctx.arc(this.x + PLAYER_WIDTH * 0.65 + 1.5, drawY + 15, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // Dash trail
      if (this.dashing) {
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = `rgba(231,76,60,${0.3 - i * 0.08})`
          roundRect(ctx, this.x - i * 14, drawY + 4, PLAYER_WIDTH, h - 8, 5)
        }
      }
    }

    // Name label above
    ctx.fillStyle = COLORS.inkSoft
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ANAK KOS', this.x + PLAYER_WIDTH / 2, this.y - 6)
  }
}
