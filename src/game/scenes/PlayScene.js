// ─── Play scene ───────────────────────────────────────────────────────────────
// Core gameplay: spawning, physics, collision, combo, HUD.
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  BASE_SPEED,
  SPEED_RAMP,
  NEAR_MISS_DISTANCE,
  COMBO_DECAY_TIME,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_MAX,
  PLAYER_X,
  PLAYER_WIDTH,
} from '../constants.js'
import { COLORS, FONTS, KASTA_BG } from '../theme.js'
import { lerp, aabb } from '../core/utils.js'
import { INTENT } from '../core/Input.js'
import { Player } from '../entities/Player.js'
import { Obstacle } from '../entities/Obstacle.js'
import { FloatText } from '../entities/FloatText.js'
import { getKasta, comboMultiplier, nearMissText } from '../systems/score.js'

const INVINCIBLE_TIME = 1.5 // seconds of i-frames after a hit
const DEATH_DELAY = 0.7 // seconds between final hit and game-over screen
const START_LIVES = 3

export class PlayScene {
  constructor(game) {
    this.game = game
    this.player = new Player()
  }

  enter() {
    this.dist = 0
    this.spd = BASE_SPEED
    this.lives = START_LIVES
    this.combo = 0
    this.mult = 1
    this.comboTimer = 0 // time since last near-miss
    this.alive = true
    this.deathTimer = 0
    this.obs = []
    this.spawnTimer = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
    this.player.reset()
    this.game.floats.length = 0
  }

  _spawnFloats(requests) {
    for (const r of requests) {
      this.game.floats.push(new FloatText(r.text, r.x, r.y, r.color, r.size))
    }
  }

  update(dt) {
    if (!this.alive) {
      // Wait out the death delay, then hand off to game over.
      this.deathTimer -= dt
      if (this.deathTimer <= 0) {
        this.game.lastDist = Math.floor(this.dist)
        this.game.go('gameover')
      }
      return
    }

    // Speed ramp + distance accrual
    this.spd = BASE_SPEED + (this.dist / 10) * SPEED_RAMP
    this.dist += (this.spd / 200) * dt

    // ── Input → actions ─────────────────────────────────────────────────────────
    const input = this.game.input
    if (input.anyPressed(INTENT.jump)) this._spawnFloats(this.player.jump())
    if (input.anyPressed(INTENT.slide)) this._spawnFloats(this.player.slide())
    if (input.anyPressed(INTENT.dash)) this._spawnFloats(this.player.dash())

    this.player.update(dt)

    // ── Spawning ────────────────────────────────────────────────────────────────
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.obs.push(Obstacle.random())
      const base = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
      this.spawnTimer = Math.max(0.5, base - this.dist * 0.00012)
    }

    // ── Obstacle movement, near-miss, collision ─────────────────────────────────
    const playerRight = this.player.x + PLAYER_WIDTH
    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i]
      o.update(dt, this.spd)

      this._checkNearMiss(o, playerRight)
      this._checkCollision(o)

      if (o.offscreen) this.obs.splice(i, 1)
    }

    // ── Combo decay ─────────────────────────────────────────────────────────────
    if (this.combo > 0) {
      this.comboTimer += dt
      if (this.comboTimer > COMBO_DECAY_TIME) {
        this.combo = 0
        this.mult = 1
      }
    }
  }

  _checkNearMiss(o, playerRight) {
    if (o.passed || o.nearMissed) return
    const gap = o.x - playerRight
    if (gap >= 0 && gap < NEAR_MISS_DISTANCE) {
      o.nearMissed = true
      this._onNearMiss()
    } else if (gap < 0 && o.x + o.w < PLAYER_X - NEAR_MISS_DISTANCE * 2) {
      o.passed = true
    }
  }

  _checkCollision(o) {
    if (this.player.invincible) return
    if (!aabb(this.player.bounds, o.bounds)) return

    // Snap-back is immune to everything; forward dash breaks mid doors.
    if (this.player.snappingBack) return
    if (this.player.dashing && o.zone === 'mid') return

    this._takeDamage()
  }

  _onNearMiss() {
    this.combo++
    this.mult = comboMultiplier(this.combo)
    this.comboTimer = 0
    const p = this.player
    this.game.floats.push(
      new FloatText(nearMissText(this.combo), p.x + PLAYER_WIDTH / 2, p.y - 40, COLORS.gold, 22)
    )
    this.game.shake.trigger(5, 0.18)
  }

  _takeDamage() {
    this.lives--
    this.combo = 0
    this.mult = 1
    this.player.hit(INVINCIBLE_TIME)
    this.game.shake.trigger(12, 0.3)
    const p = this.player
    this.game.floats.push(new FloatText('AW!', p.x + PLAYER_WIDTH / 2, p.y - 20, COLORS.accent, 20))
    if (this.lives <= 0) {
      this.alive = false
      this.deathTimer = DEATH_DELAY
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  draw(ctx) {
    const kasta = getKasta(this.dist)
    ctx.fillStyle = KASTA_BG[kasta]
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    this.game.drawFloor(ctx)

    this.obs.forEach((o) => o.draw(ctx))
    this.player.draw(ctx)

    this._drawHud(ctx, kasta)
  }

  _drawHud(ctx, kasta) {
    // Distance + multiplier
    ctx.fillStyle = COLORS.ink
    ctx.font = `bold 22px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText(`${Math.floor(this.dist)}m  ×${this.mult}`, GAME_WIDTH / 2, 28)

    // Lives
    ctx.font = `22px ${FONTS.sans}`
    ctx.textAlign = 'left'
    ctx.fillText('♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, START_LIVES - this.lives)), 12, 30)

    // Combo
    if (this.combo > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold 15px ${FONTS.mono}`
      ctx.textAlign = 'center'
      ctx.fillText(`COMBO x${this.combo}  ×${this.mult}`, GAME_WIDTH / 2, 54)
    }

    // Kasta
    ctx.fillStyle = COLORS.muted
    ctx.font = `12px ${FONTS.mono}`
    ctx.textAlign = 'left'
    ctx.fillText(`KASTA: ${kasta}`, 12, GAME_HEIGHT - 36)

    // Dash indicator
    ctx.textAlign = 'right'
    if (this.player.dashCd > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.fillText(`DASH: ${this.player.dashCd.toFixed(1)}s`, GAME_WIDTH - 12, GAME_HEIGHT - 36)
    } else {
      ctx.fillStyle = COLORS.green
      ctx.fillText('DASH: READY', GAME_WIDTH - 12, GAME_HEIGHT - 36)
    }

    // Controls hint
    ctx.fillStyle = COLORS.faint
    ctx.font = `10px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText('TAP=Lompat  ↓=Slide  →=Dash', GAME_WIDTH / 2, GAME_HEIGHT - 14)
  }
}
