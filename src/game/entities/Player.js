// ─── Player ───────────────────────────────────────────────────────────────────
import {
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

const DASH_RIGHT_MARGIN = 20
const SNAP_BACK_TIME = 0.22

export class Player {
  constructor(game) {
    this.game = game
    // Don't call reset() here — PlayScene calls it in enter() once game is fully initialized
    this.x = 0; this.y = 0; this.vy = 0
    this.grounded = false; this.jumps = 2
    this.sliding = false; this.slideTimer = 0
    this.dashing = false; this.dashTimer = 0; this.dashCd = 0
    this.invTimer = 0; this._snapFrom = 0; this._snapTimer = 0
  }

  get S() { return this.game.scale }
  get floorY() { return this.game.floorY }

  // Scaled dimensions
  get w() { return Math.round(PLAYER_WIDTH * this.S) }
  get baseH() { return Math.round(PLAYER_HEIGHT * this.S) }
  get height() { return this.sliding ? Math.round(this.baseH / 2) : this.baseH }

  reset() {
    const S = this.S
    this.x = Math.round(PLAYER_X * S)
    this.y = this.floorY - this.baseH
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

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.height }
  }

  get invincible() { return this.invTimer > 0 }
  get snappingBack() { return this._snapTimer > 0 }

  jump() {
    if (this.sliding) { this.sliding = false; return [] }
    if (this.jumps <= 0) return []
    const S = this.S
    this.vy = (this.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY) * S
    this.jumps--
    this.grounded = false
    return [{ text: '↑', x: this.x + this.w / 2, y: this.y - 4, color: COLORS.white, size: Math.round(20 * S) }]
  }

  slide() {
    if (!this.grounded || this.sliding) return []
    this.sliding = true
    this.slideTimer = SLIDE_DURATION
    const S = this.S
    return [{ text: 'SLIDE!', x: this.x + this.w / 2, y: this.y - 16 * S, color: '#9b59b6', size: Math.round(22 * S) }]
  }

  dash() {
    if (this.dashing || this.dashCd > 0) return []
    this.dashing = true
    this.dashTimer = DASH_DURATION
    this.dashCd = DASH_COOLDOWN
    this._snapTimer = 0
    const S = this.S
    return [{ text: 'DASH!', x: this.x + 50 * S, y: this.y + 10 * S, color: '#e67e22', size: Math.round(22 * S) }]
  }

  hit(invDuration) { this.invTimer = invDuration }

  update(dt) {
    const S = this.S
    const gravity = GRAVITY * S
    const floorTop = this.floorY - this.height
    const homeX = Math.round(PLAYER_X * S)
    const rightWall = this.game.width - this.w - Math.round(DASH_RIGHT_MARGIN * S)

    this.vy += gravity * dt
    this.y += this.vy * dt

    if (this.y >= floorTop) {
      this.y = floorTop
      this.vy = 0
      this.grounded = true
      this.jumps = 2
    } else {
      this.grounded = false
    }

    if (this.sliding) {
      this.slideTimer -= dt
      if (this.slideTimer <= 0) this.sliding = false
    }

    if (this.dashing) {
      this.x = Math.min(rightWall, this.x + DASH_VELOCITY * S * dt)
      this.dashTimer -= dt
      if (this.dashTimer <= 0) {
        this.dashing = false
        this._snapFrom = this.x
        this._snapTimer = SNAP_BACK_TIME
      }
    }

    if (this._snapTimer > 0) {
      this._snapTimer -= dt
      const t = 1 - Math.max(0, this._snapTimer / SNAP_BACK_TIME)
      this.x = lerp(this._snapFrom, homeX, easeOut(t))
      if (this._snapTimer <= 0) this.x = homeX
    }

    if (this.dashCd > 0) this.dashCd -= dt
    if (this.invTimer > 0) this.invTimer -= dt
  }

  draw(ctx) {
    const S = this.S
    const h = this.height
    const drawY = this.sliding ? this.floorY - this.baseH / 2 : this.y
    const visible = this.invTimer <= 0 || Math.floor(this.invTimer * 12) % 2 === 0

    if (visible) {
      ctx.fillStyle = COLORS.player
      roundRect(ctx, this.x, drawY, this.w, h, Math.round(5 * S))

      if (!this.sliding) {
        const eyeX = this.x + this.w * 0.65
        const eyeY = drawY + Math.round(14 * S)
        const eyeR = Math.round(5 * S)
        ctx.fillStyle = COLORS.playerEye
        ctx.beginPath()
        ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLORS.playerPupil
        ctx.beginPath()
        ctx.arc(eyeX + Math.round(1.5 * S), eyeY + Math.round(S), Math.round(2.5 * S), 0, Math.PI * 2)
        ctx.fill()
      }

      if (this.dashing) {
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = `rgba(231,76,60,${0.3 - i * 0.08})`
          roundRect(ctx, this.x - i * Math.round(14 * S), drawY + Math.round(4 * S), this.w, h - Math.round(8 * S), Math.round(5 * S))
        }
      }
    }

    ctx.fillStyle = COLORS.inkSoft
    ctx.font = `${Math.round(13 * S)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('ANAK KOS', this.x + this.w / 2, this.y - Math.round(6 * S))
  }
}
