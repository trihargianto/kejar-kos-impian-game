// ─── Play scene ───────────────────────────────────────────────────────────────
// Core gameplay: spawning, physics, collision, combo, HUD.
import {
  BASE_SPEED,
  SPEED_RAMP,
  NEAR_MISS_DISTANCE,
  COMBO_DECAY_TIME,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_MAX,
  PLAYER_WIDTH,
  PLAYER_X,
} from '../constants.js'
import { COLORS, FONTS, KASTA_BG } from '../theme.js'
import { lerp, aabb } from '../core/utils.js'
import { INTENT } from '../core/Input.js'
import { Player } from '../entities/Player.js'
import { Obstacle } from '../entities/Obstacle.js'
import { FloatText } from '../entities/FloatText.js'
import { getKasta, comboMultiplier, nearMissText } from '../systems/score.js'

const INVINCIBLE_TIME = 1.5
const DEATH_DELAY = 0.7
const START_LIVES = 3

export class PlayScene {
  constructor(game) {
    this.game = game
    this.player = new Player(game)
  }

  enter() {
    this.dist = 0
    this.spd = BASE_SPEED
    this.lives = START_LIVES
    this.combo = 0
    this.mult = 1
    this.comboTimer = 0
    this.alive = true
    this.deathTimer = 0
    this.obs = []
    this.spawnTimer = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
    this.player.reset()
    this.game.floats.length = 0
    this.showControls = true
  }

  _spawnFloats(requests) {
    for (const r of requests) {
      this.game.floats.push(new FloatText(r.text, r.x, r.y, r.color, r.size))
    }
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer -= dt
      if (this.deathTimer <= 0) {
        this.game.lastDist = Math.floor(this.dist)
        this.game.go('gameover')
      }
      return
    }

    this.spd = BASE_SPEED + (this.dist / 10) * SPEED_RAMP
    this.dist += (this.spd / 200) * dt

    // ── Input → actions ─────────────────────────────────────────────────────────
    const input = this.game.input
    if (input.anyPressed(INTENT.jump)) {
      this.showControls = false
      this._spawnFloats(this.player.jump())
    }
    if (input.anyPressed(INTENT.slide)) {
      this.showControls = false
      this._spawnFloats(this.player.slide())
    }
    if (input.anyPressed(INTENT.dash)) {
      this.showControls = false
      this._spawnFloats(this.player.dash())
    }

    this.player.update(dt)

    // ── Spawning ────────────────────────────────────────────────────────────────
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.obs.push(Obstacle.random(this.game))
      const base = lerp(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX, Math.random())
      this.spawnTimer = Math.max(0.5, base - this.dist * 0.00012)
    }

    // ── Obstacle movement, near-miss, collision ─────────────────────────────────
    const S = this.game.scale
    const nearMissDist = NEAR_MISS_DISTANCE * S
    const playerRight = this.player.x + this.player.w
    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i]
      o.update(dt, this.spd * S)

      this._checkNearMiss(o, playerRight, nearMissDist)
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

  _checkNearMiss(o, playerRight, nearMissDist) {
    if (o.passed || o.nearMissed) return
    const gap = o.x - playerRight
    if (gap >= 0 && gap < nearMissDist) {
      o.nearMissed = true
      this._onNearMiss()
    } else if (gap < 0 && o.x + o.w < this.player.x - nearMissDist * 2) {
      o.passed = true
    }
  }

  _checkCollision(o) {
    if (this.player.invincible) return
    if (!aabb(this.player.bounds, o.bounds)) return
    if (this.player.snappingBack) return
    if (this.player.dashing && o.zone === 'mid') return
    this._takeDamage()
  }

  _onNearMiss() {
    this.combo++
    this.mult = comboMultiplier(this.combo)
    this.comboTimer = 0
    const p = this.player
    const S = this.game.scale
    this.game.floats.push(
      new FloatText(nearMissText(this.combo), p.x + p.w / 2, p.y - 40 * S, COLORS.gold, Math.round(28 * S))
    )
    this.game.shake.trigger(5 * S, 0.18)
  }

  _takeDamage() {
    this.lives--
    this.combo = 0
    this.mult = 1
    this.player.hit(INVINCIBLE_TIME)
    const S = this.game.scale
    this.game.shake.trigger(12 * S, 0.3)
    const p = this.player
    this.game.floats.push(new FloatText('AW!', p.x + p.w / 2, p.y - 20 * S, COLORS.accent, Math.round(28 * S)))
    if (this.lives <= 0) {
      this.alive = false
      this.deathTimer = DEATH_DELAY
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  draw(ctx) {
    const { width: W, height: H } = this.game
    const kasta = getKasta(this.dist)
    ctx.fillStyle = KASTA_BG[kasta]
    ctx.fillRect(0, 0, W, H)
    this.game.drawFloor(ctx)

    this.obs.forEach((o) => o.draw(ctx))
    this.player.draw(ctx)

    this._drawHud(ctx, kasta)
  }

  _drawHud(ctx, kasta) {
    const { width: W, height: H, scale: S, safeTop, safeBottom } = this.game
    const TOP = safeTop + 8
    const BOT = H - safeBottom - 8
    const fs = (n) => Math.round(n * S)

    // Lives — top left
    ctx.fillStyle = COLORS.ink
    ctx.font = `${fs(22)}px ${FONTS.sans}`
    ctx.textAlign = 'left'
    ctx.fillText('♥'.repeat(this.lives) + '♡'.repeat(Math.max(0, START_LIVES - this.lives)), fs(12), TOP + fs(22))

    // Distance — top center
    ctx.font = `bold ${fs(22)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    const scoreStr = this.combo > 0
      ? `${Math.floor(this.dist)}m  ×${this.mult}`
      : `${Math.floor(this.dist)}m`
    ctx.fillText(scoreStr, W / 2, TOP + fs(22))

    // Combo — below score
    if (this.combo > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.font = `bold ${fs(15)}px ${FONTS.mono}`
      ctx.fillText(`COMBO x${this.combo}`, W / 2, TOP + fs(44))
    }

    // Kasta — bottom left
    ctx.fillStyle = COLORS.muted
    ctx.font = `${fs(12)}px ${FONTS.mono}`
    ctx.textAlign = 'left'
    ctx.fillText(`KASTA: ${kasta}`, fs(12), BOT - fs(18))

    // Dash — bottom right
    ctx.textAlign = 'right'
    if (this.player.dashCd > 0) {
      ctx.fillStyle = COLORS.accent
      ctx.fillText(`DASH: ${this.player.dashCd.toFixed(1)}s`, W - fs(12), BOT - fs(18))
    } else {
      ctx.fillStyle = COLORS.green
      ctx.fillText('DASH: READY', W - fs(12), BOT - fs(18))
    }

    // Controls hint — only until first input
    if (this.showControls) {
      ctx.fillStyle = COLORS.faint
      ctx.font = `${fs(10)}px ${FONTS.mono}`
      ctx.textAlign = 'center'
      ctx.fillText('TAP=Lompat  ↓=Slide  →=Dash', W / 2, BOT - fs(2))
    }
  }
}
