// ─── Player ───────────────────────────────────────────────────────────────────
// Movement + state via a StateMachine. States:
//   running  → grounded or airborne, can jump/dash; can also queue an air-slide
//              (press SLIDE mid-air → on natural landing, smoothly enters slide;
//              no y-snap, gravity integrates normally; jump/dash cancel the queue)
//   sliding  → ground-only pose, low hitbox, time-limited; JUMP cancels into
//              a real jump (one press launches, no need to tap twice)
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
  KOPI_DURATION,
  SANDAL_AMMO,
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
        // Jump supersedes a queued air-slide (player changed their mind).
        p._slideQueued = false
        if (p.jumps <= 0) return null
        p.vy = (p.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY) * p.S
        p.jumps--
        p.grounded = false
        p._lastFloats.push(p._float('↑', 0, -4, COLORS.white, 20))
        p._emit('jump')
        return null // stay in running; air physics handled in update
      }
      if (event === 'intent:slide') {
        if (!p.grounded) {
          // Air-slide: queue the slide. Gravity keeps integrating so the
          // player falls to the floor smoothly — no y-snap. The slide fires
          // on natural landing contact (see update below). Jump/dash cancel.
          p._slideQueued = true
          p._lastFloats.push(p._float('↓', 0, -4, '#9b59b6', 18))
          return null
        }
        p.slideTimer = SLIDE_DURATION
        p._lastFloats.push(p._float('SLIDE!', 0, -16, '#9b59b6', 22))
        p._emit('slide')
        return 'sliding'
      }
      if (event === 'intent:dash') {
        // Dash supersedes a queued air-slide.
        p._slideQueued = false
        if (p.dashCd > 0) return null
        // Lantai licin (AC Standar, GDD §VI): low friction → the dash burst
        // carries longer before snap-back. friction defaults to 1 (no effect).
        p.dashTimer = DASH_DURATION / Math.max(0.2, p.friction)
        p.dashCd = DASH_COOLDOWN
        p._snapTimer = 0
        p._lastFloats.push(p._float('DASH!', 50, 10, '#e67e22', 22))
        p._emit('dash')
        return 'dashing'
      }
      return null
    },
    update(dt, p) {
      const wasGrounded = p.grounded
      applyGravity(dt, p)
      applyDashCooldown(dt, p)
      applyInvincibility(dt, p)
      // Consume a queued air-slide on the frame the player lands naturally.
      // No y-snap: gravity already brought them to the floor, so the landing
      // reads smoothly and the slide starts from the running contact point.
      if (p._slideQueued && !wasGrounded && p.grounded) {
        p._slideQueued = false
        p.slideTimer = SLIDE_DURATION
        p._lastFloats.push(p._float('SLIDE!', 0, -16, '#9b59b6', 22))
        p._emit('slide')
        p.fsm.transition('sliding')
      }
    },
  }
}

function slidingState() {
  return {
    enter(_prev, _payload, p) {
      p.sliding = true
    },
    on(event, _payload, p) {
      if (event === 'intent:jump') {
        // Jump out of slide: one press both cancels the slide AND launches.
        // Reset to the standing floor position first so applyGravity doesn't
        // see the half-height pose's low y as "below floor" and snap us back,
        // zeroing the jump velocity on the next frame.
        if (p.jumps <= 0) return 'running'
        p.y = p.floorY - p.baseH
        p.vy = (p.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY) * p.S
        p.jumps--
        p.grounded = false
        p._lastFloats.push(p._float('↑', 0, -4, COLORS.white, 20))
        p._emit('jump')
        return 'running'
      }
      if (event === 'intent:slide') {
        // Re-press while sliding starts a fresh slide: reset the timer to a full
        // SLIDE_DURATION from now. Tapping repeatedly keeps the slide going
        // (effectively hold-to-slide), so the player can ride out a long stretch
        // of ceiling obstacles by re-pressing instead of being forced up.
        p.slideTimer = SLIDE_DURATION
        p._lastFloats.push(p._float('SLIDE!', 0, -16, '#9b59b6', 20))
        p._emit('slide')
        return null // stay in sliding
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

// Shared: a jump pressed mid-dash / mid-snap-back cancels the burst and launches
// immediately, so the player keeps air control instead of eating a ~0.4s dead
// window (DASH_DURATION + SNAP_BACK_TIME) where input was silently dropped.
// Returns 'running' (with the jump applied) or null to stay in the state.
function jumpOutOfBurst(p) {
  if (p.jumps <= 0) return null
  p.vy = (p.jumps === 2 ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY) * p.S
  p.jumps--
  p.grounded = false
  p.dashing = false
  p.snappingBack = false
  p.x = Math.round(PLAYER_X * p.S) // settle back to home X so the launch is clean
  p._lastFloats.push(p._float('↑', 0, -4, COLORS.white, 20))
  p._emit('jump')
  return 'running'
}

function dashingState() {
  return {
    enter(_prev, _payload, p) {
      p.dashing = true
    },
    on(event, _payload, p) {
      if (event === 'intent:jump') return jumpOutOfBurst(p)
      // Buffer a slide pressed during the dash burst: it fires on natural
      // landing (same air-slide path as running), instead of being dropped.
      if (event === 'intent:slide' && !p.grounded) {
        p._slideQueued = true
        return null
      }
      return null
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
    on(event, _payload, p) {
      if (event === 'intent:jump') return jumpOutOfBurst(p)
      if (event === 'intent:slide' && !p.grounded) {
        p._slideQueued = true
        return null
      }
      return null
    },
    update(dt, p) {
      const wasGrounded = p.grounded
      applyGravity(dt, p)
      applyDashCooldown(dt, p)
      applyInvincibility(dt, p)
      // Consume a slide buffered during dash/snap-back if we land here before
      // returning to running (otherwise the queued slide would be dropped).
      if (p._slideQueued && !wasGrounded && p.grounded) {
        p._slideQueued = false
        p.slideTimer = SLIDE_DURATION
        p.snappingBack = false
        p._lastFloats.push(p._float('SLIDE!', 0, -16, '#9b59b6', 22))
        p._emit('slide')
        p.x = Math.round(PLAYER_X * p.S)
        return p.fsm.transition('sliding')
      }
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
    this.friction = 1 // <1 = lantai licin (kasta twist); set by the scene each frame
    this.worldSpeed = 0 // current world scroll speed (px/s); set by the scene each frame
    // Power-ups (GDD §VII)
    this.boostTimer = 0 // Kopi Sachet speed-boost window; speed mult applies while > 0
    this.sandals = 0 // Sandal Jepit ammo (reset to SANDAL_AMMO on pickup)
    this._snapFrom = 0
    this._snapTimer = 0
    this.snappingBack = false
    this._slideQueued = false // air-slide buffer; consumed on natural landing
    // Run-cycle phase (radians). Advances only while grounded-running so the
    // single run sprite gets a procedural bob/tilt/squash and reads as alive
    // instead of a stiff static decal. Frozen while airborne/sliding/dashing.
    this._runPhase = 0
    this._lastFloats = []
    this.fsm = new StateMachine(
      'running',
      {
        running: runningState(),
        sliding: slidingState(),
        dashing: dashingState(),
        snapBack: snapBackState(),
      },
      this
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
    this.friction = 1
    this.boostTimer = 0
    this.sandals = 0
    this._snapFrom = 0
    this._snapTimer = 0
    this.snappingBack = false
    this._slideQueued = false
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

  // Kopi Sachet speed boost is active (GDD §VII Passive). Independent of
  // invincibility: a hit during boost still skips damage via invTimer, but
  // the speed window can outlast the i-frame window if we tune them apart.
  get boosting() {
    return this.boostTimer > 0
  }

  // Passive: Kopi Sachet — sets the speed-boost window AND extends the
  // life-system invTimer so damage is skipped for the same 5s (GDD: "boost
  // kecepatan + imun 5 detik", "reuse invuln timer dari life system").
  // Near-miss is independent of invincibility (see CollisionSystem), so the
  // combo chain keeps rolling during the boost.
  applyKopi(duration = KOPI_DURATION) {
    const prevBoosting = this.boosting
    this.boostTimer = Math.max(this.boostTimer, duration)
    this.invTimer = Math.max(this.invTimer, duration)
    return { started: !prevBoosting, duration }
  }

  // Active: Sandal Jepit — pickup resets ammo to SANDAL_AMMO (not cumulative,
  // per GDD "Pickup sandal → reset amunisi ke 3 (bukan akumulasi/nambah)").
  applySandalAmmo(ammo = SANDAL_AMMO) {
    this.sandals = ammo
    return this.sandals
  }

  // Returns true if there was ammo to spend (the throw lands), false otherwise.
  consumeSandal() {
    if (this.sandals <= 0) return false
    this.sandals--
    return true
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

  // Hold-to-slide: called every frame the SLIDE button/key is held. Quietly
  // keeps the slide alive (refresh the timer) without re-emitting the SLIDE!
  // float or slide audio each frame. Only acts while already grounded+sliding;
  // entering the slide is the edge press's job (slide()), so a held button that
  // started mid-air doesn't silently teleport into a slide on landing.
  holdSlide() {
    if (this.sliding) this.slideTimer = SLIDE_DURATION
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
    if (this.boostTimer > 0) this.boostTimer -= dt
    // Advance the run cycle only when actually pounding the floor. Airborne /
    // sliding / dashing freeze it (their own poses read the motion), and we ease
    // back toward a neutral foot-plant so resuming the run doesn't pop.
    const running = this.grounded && !this.sliding && !this.dashing
    if (running) {
      // ~2 steps/sec base, scaled up with the world so legs match ground speed.
      const stride = 10 + (this.worldSpeed ?? 0) * 0.012
      this._runPhase += dt * stride
    }
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────
  // Sprite-first with placeholder fallback (GDD §XVI Step 4). Sprites are sized
  // to the hitbox (run 52:76, slide 52:38), so drawImage targets the same rect
  // the collision system reads — no offset. Sliding uses the slide sprite; jump
  // reuses the run sprite until a jump pose exists.
  draw(ctx) {
    const S = this.S
    const h = this.height
    const drawY = this.sliding ? this.floorY - this.baseH / 2 : this.y
    // Damage i-frames: invTimer is set by BOTH a hit and Kopi Sachet immunity
    // (they share the timer). The blink + hurt pose are a DAMAGE tell, so gate
    // them on "hurt but not boosting" — Kopi immunity must not look like injury.
    const hurting = this.invTimer > 0 && !this.boosting
    const visible = !hurting || Math.floor(this.invTimer * 12) % 2 === 0

    // Pose priority: hurt (damage i-frames only) → slide → airborne jump → run.
    // Each falls back to run if its sprite is missing, and run falls back to the
    // placeholder. Hurt wins so the recoil pose reads during the blink window.
    const assets = this.game.assets
    let spriteId = 'player:run'
    if (hurting && assets?.has('player:hurt')) spriteId = 'player:hurt'
    else if (this.sliding) spriteId = 'player:slide'
    else if (!this.grounded && assets?.has('player:jump')) spriteId = 'player:jump'
    const sprite = assets?.has(spriteId) ? assets.image(spriteId) : null

    if (visible) {
      // Dash echo: faint trailing copies behind the player to sell the burst.
      if (this.dashing) {
        ctx.save()
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = 0.3 - i * 0.08
          const ex = this.x - i * Math.round(14 * S)
          if (sprite) ctx.drawImage(sprite, ex, drawY, this.w, h)
          else {
            ctx.fillStyle = COLORS.player
            roundRect(ctx, ex, drawY + Math.round(4 * S), this.w, h - Math.round(8 * S), Math.round(5 * S))
          }
        }
        ctx.restore()
      }

      if (sprite) {
        this._drawRunnerSprite(ctx, sprite, drawY, h)
      } else {
        this._drawPlaceholder(ctx, S, h, drawY)
      }
    }
  }

  // Draw the sprite with a procedural run cycle so the single static frame reads
  // as a real run: a vertical bob (two foot-plants per stride), a slight squash
  // at the bottom of each plant, and a small forward lean. Only active while
  // grounded-running; airborne/sliding/dashing draw the sprite flat (their pose
  // already conveys motion). The transform pivots on the feet so the hitbox top
  // (drawY) and collision are untouched — purely cosmetic.
  _drawRunnerSprite(ctx, sprite, drawY, h) {
    const running = this.grounded && !this.sliding && !this.dashing
    if (!running) {
      ctx.drawImage(sprite, this.x, drawY, this.w, h)
      return
    }
    const p = this._runPhase
    // |sin| → two plants per cycle. Body rides UP between plants (negative bob).
    const bob = -Math.abs(Math.sin(p)) * h * 0.05
    // Squash: shortest at the foot-plant (sin≈0), tallest mid-air-step.
    const squash = 1 - (1 - Math.abs(Math.sin(p))) * 0.06
    const lean = 0.06 // radians forward tilt while running

    const cx = this.x + this.w / 2
    const feetY = drawY + h
    ctx.save()
    ctx.translate(cx, feetY)
    ctx.rotate(lean)
    ctx.translate(-cx, -feetY)
    const sh = h * squash
    ctx.drawImage(sprite, this.x, feetY - sh + bob, this.w, sh)
    ctx.restore()
  }

  // Original primitive-shape player: red rounded body + eye. Kept as the fallback
  // while a sprite is missing/loading so the game never renders an empty player.
  _drawPlaceholder(ctx, S, h, drawY) {
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
