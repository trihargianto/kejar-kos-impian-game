// ─── Player ───────────────────────────────────────────────────────────────────
// Movement + state via a StateMachine. States:
//   running  → grounded or airborne, can jump/dash
//   sliding  → ground-only, low hitbox, time-limited
//   dashing  → forward burst, ignores mid-zone collisions
//   snapBack → easing back to home X after a dash
//   hurt     → invincible window after a hit
//
// Each state owns its own transition logic via `on(event)` and per-frame
// `update(dt)`. Air vs. ground physics are still inside the states (vertical
// velocity + gravity), so jump/slide interop stays coherent.
//
// Public API used by the scene is unchanged: jump()/slide()/dash()/hit() return
// float-text requests, `bounds` is the current AABB, `invincible`/`dashing`/
// `snappingBack` flags are derived from the FSM for backward-compat with the
// collision system.
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
import { StateMachine } from '../core/State.js'

const DASH_RIGHT_MARGIN = 20
const SNAP_BACK_TIME = 0.22

// ─── Player state definitions ────────────────────────────────────────────────
// Each state receives `p` (the Player instance) as ctx.

function runningState() {
  return {
    on(event, _payload, p) {
      if (event === 'intent:jump') {
        if (p.jumps <= 0) return null
        p.vy = (p.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY) * p.S
        p.jumps--
        p.grounded = false
        p._lastFloats.push(p._float('↑', 0, -4, COLORS.white, 20))
        p._emit('jump')
        return null // stay in running; air physics handled in update
      }
      if (event === 'intent:slide') {
        if (!p.grounded) return null
        p.slideTimer = SLIDE_DURATION
        p._lastFloats.push(p._float('SLIDE!', 0, -16, '#9b59b6', 22))
        p._emit('slide')
        return 'sliding'
      }
      if (event === 'intent:dash') {
        if (p.dashCd > 0) return null
        p.dashTimer = DASH_DURATION
        p.dashCd = DASH_COOLDOWN
        p._snapTimer = 0
        p._lastFloats.push(p._float('DASH!', 50, 10, '#e67e22', 22))
        p._emit('dash')
        return 'dashing'
      }
      return null
    },
    update(dt, p) {
      applyGravity(dt, p)
      applyDashCooldown(dt, p)
      applyInvincibility(dt, p)
    },
  }
}

function slidingState() {
  return {
    enter(_prev, _payload, p) {
      p.sliding = true
    },
    // eslint-disable-next-line no-unused-vars
    on(event, _payload, _p) {
      if (event === 'intent:jump') {
        // Jump cancels slide (no air jump from a slide). No float is emitted —
        // matches original behavior; the player can tap again to actually jump.
        return 'running'
      }
      return null
    },
    update(dt, p) {
      applyGravity(dt, p)
      applyDashCooldown(dt, p)
      applyInvincibility(dt, p)
      p.slideTimer -= dt
      if (p.slideTimer <= 0) {
        p.sliding = false
        p.fsm.transition('running')
      }
    },
    exit(_next, _payload, p) {
      p.sliding = false
    },
  }
}

function dashingState() {
  return {
    enter(_prev, _payload, p) {
      p.dashing = true
    },
    update(dt, p) {
      applyGravity(dt, p)
      applyInvincibility(dt, p)
      const rightWall = p.game.width - p.w - Math.round(DASH_RIGHT_MARGIN * p.S)
      p.x = Math.min(rightWall, p.x + DASH_VELOCITY * p.S * dt)
      p.dashTimer -= dt
      if (p.dashTimer <= 0) {
        p.dashing = false
        p._snapFrom = p.x
        p._snapTimer = SNAP_BACK_TIME
        p.fsm.transition('snapBack')
      }
    },
    exit(_next, _payload, p) {
      p.dashing = false
    },
  }
}

function snapBackState() {
  return {
    enter(_prev, _payload, p) {
      p.snappingBack = true
    },
    update(dt, p) {
      applyGravity(dt, p)
      applyDashCooldown(dt, p)
      applyInvincibility(dt, p)
      p._snapTimer -= dt
      const homeX = Math.round(PLAYER_X * p.S)
      const t = 1 - Math.max(0, p._snapTimer / SNAP_BACK_TIME)
      p.x = lerp(p._snapFrom, homeX, easeOut(t))
      if (p._snapTimer <= 0) {
        p.x = homeX
        p.fsm.transition('running')
      }
    },
    exit(_next, _payload, p) {
      p.snappingBack = false
    },
  }
}

// Shared physics helpers used across multiple states.
function applyGravity(dt, p) {
  const gravity = GRAVITY * p.S
  const floorTop = p.floorY - p.height
  p.vy += gravity * dt
  p.y += p.vy * dt
  if (p.y >= floorTop) {
    p.y = floorTop
    p.vy = 0
    p.grounded = true
    p.jumps = 2
  } else {
    p.grounded = false
  }
}

function applyDashCooldown(dt, p) {
  if (p.dashCd > 0) p.dashCd -= dt
}

function applyInvincibility(dt, p) {
  if (p.invTimer > 0) p.invTimer -= dt
}

// ─── Player entity ────────────────────────────────────────────────────────────
export class Player {
  constructor(game) {
    this.game = game
    this.x = 0
    this.y = 0
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
    this.snappingBack = false
    this._lastFloats = []
    this.fsm = new StateMachine(
      'running',
      {
        running: runningState(),
        sliding: slidingState(),
        dashing: dashingState(),
        snapBack: snapBackState(),
      },
      this,
    )
  }

  // Hook used by states to queue float-text requests + emit gameplay events.
  // Set by PlayScene on enter().
  // eslint-disable-next-line no-unused-vars
  _emit(_kind) {
    // overridden by scene wiring; default no-op so tests can construct a Player
  }

  get S() {
    return this.game.scale
  }
  get floorY() {
    return this.game.floorY
  }
  get w() {
    return Math.round(PLAYER_WIDTH * this.S)
  }
  get baseH() {
    return Math.round(PLAYER_HEIGHT * this.S)
  }
  get height() {
    return this.sliding ? Math.round(this.baseH / 2) : this.baseH
  }

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
    this.snappingBack = false
    this._lastFloats = []
    this.fsm.transition('running')
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.height }
  }

  // Derived flags (read by collision system).
  get invincible() {
    return this.invTimer > 0
  }

  // Public actions — send an intent through the FSM, then drain accumulated
  // float-text requests (pushed by the active state). Returns [] if the intent
  // was rejected (cooldown, no jumps left, etc.).
  jump() {
    this.fsm.send('intent:jump')
    return this._drainFloats()
  }

  slide() {
    this.fsm.send('intent:slide')
    return this._drainFloats()
  }

  dash() {
    this.fsm.send('intent:dash')
    return this._drainFloats()
  }

  hit(invDuration) {
    this.invTimer = invDuration
  }

  update(dt) {
    this.fsm.update(dt)
  }

  // ── Drawing (unchanged visuals) ─────────────────────────────────────────────
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
          roundRect(
            ctx,
            this.x - i * Math.round(14 * S),
            drawY + Math.round(4 * S),
            this.w,
            h - Math.round(8 * S),
            Math.round(5 * S),
          )
        }
      }
    }

    ctx.fillStyle = COLORS.inkSoft
    ctx.font = `${Math.round(13 * S)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('ANAK KOS', this.x + this.w / 2, this.y - Math.round(6 * S))
  }

  // ── Internal helpers ────────────────────────────────────────────────────────
  _float(text, dx, dy, color, size) {
    const S = this.S
    return {
      text,
      x: this.x + this.w / 2 + dx * S,
      y: this.y + dy * S,
      color,
      size: Math.round(size * S),
    }
  }

  _drainFloats() {
    const out = this._lastFloats
    this._lastFloats = []
    return out
  }
}
