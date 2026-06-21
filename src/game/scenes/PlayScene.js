// ─── Play scene (orchestrator) ────────────────────────────────────────────────
// Owns the high-level run loop: input → player → spawn → obstacles → collision
// → combo → game-over transition. All mechanics live in dedicated modules:
//   SpawnDirector   — when/what to spawn (kasta-aware)
//   CollisionSystem — geometry tests (pure functions)
//   ComboSystem     — near-miss multiplier + decay
//   Hud             — top/bottom HUD draw
//
// Adding a feature (collectibles, Ibu Kos chaser, kasta twists) should extend
// one of those modules or add a new one — not grow this file.
import { BASE_SPEED, SPEED_RAMP, INVINCIBLE_TIME, DEATH_DELAY, START_LIVES } from '../constants.js'
import { KASTA_BG } from '../theme.js'
import { COLORS } from '../theme.js'
import { FloatText } from '../entities/FloatText.js'
import { Player } from '../entities/Player.js'
import { INTENT } from '../core/Input.js'
import { getKastaDef } from '../kasta.js'
import { nearMissText } from '../systems/score.js'
import { EVENTS } from '../core/EventBus.js'
import { SpawnDirector } from './play/SpawnDirector.js'
import { ComboSystem } from './play/ComboSystem.js'
import { Hud } from './play/Hud.js'
import { testObstacle, scaledNearMissDist } from './play/CollisionSystem.js'

export class PlayScene {
  constructor(game) {
    this.game = game
    this.player = new Player(game)
    // Wire player → event bus so jump/slide/dash can drive audio + analytics
    // without the scene shuttling each call manually.
    this.player._emit = (kind) => {
      const map = { jump: EVENTS.PLAYER_JUMP, slide: EVENTS.PLAYER_SLIDE, dash: EVENTS.PLAYER_DASH }
      if (map[kind]) this.game.events?.emit(map[kind])
    }

    this.spawner = new SpawnDirector()
    this.combo = new ComboSystem()
    this.hud = new Hud()
    this.obs = []
    this._lastKastaId = null
  }

  enter() {
    const kasta = getKastaDef(0)
    this.dist = 0
    this.spd = BASE_SPEED
    this.lives = START_LIVES
    this.alive = true
    this.deathTimer = 0
    this.obs = []
    this.spawner.reset()
    this.combo.reset()
    this.player.reset()
    this.game.floats.length = 0
    this.showControls = true
    this._lastKastaId = kasta.id
    this.game.events?.emit(EVENTS.GAME_START)
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer -= dt
      if (this.deathTimer <= 0) {
        this.game.lastDist = Math.floor(this.dist)
        this.game.events?.emit(EVENTS.GAME_OVER, { dist: this.game.lastDist })
        this.game.go('gameover')
      }
      return
    }

    this._updateSpeed()
    this._updateDistance(dt)
    this._handleInput()
    this.player.update(dt)
    this._updateSpawning(dt)
    this._updateObstacles(dt)
    this.combo.update(dt)
    this._updateKasta()
  }

  // ── Sub-steps ───────────────────────────────────────────────────────────────
  _updateSpeed() {
    this.spd = BASE_SPEED + (this.dist / 10) * SPEED_RAMP
  }

  _updateDistance(dt) {
    this.dist += (this.spd / 200) * dt
  }

  _handleInput() {
    const input = this.game.input
    let firstInput = false

    if (input.anyPressed(INTENT.jump)) {
      firstInput = true
      this._spawnFloats(this.player.jump())
    }
    if (input.anyPressed(INTENT.slide)) {
      firstInput = true
      this._spawnFloats(this.player.slide())
    }
    if (input.anyPressed(INTENT.dash)) {
      firstInput = true
      this._spawnFloats(this.player.dash())
    }

    if (firstInput) this.showControls = false
  }

  _updateSpawning(dt) {
    const o = this.spawner.update(dt, this.game, this.dist)
    if (o) this.obs.push(o)
  }

  _updateObstacles(dt) {
    const S = this.game.scale
    const nearMissDist = scaledNearMissDist(this.game)

    for (let i = this.obs.length - 1; i >= 0; i--) {
      const o = this.obs[i]
      o.update(dt, this.spd * S)

      const result = testObstacle(o, this.player, nearMissDist)
      if (result === 'near-miss') {
        this._onNearMiss()
      } else if (result === 'dash-break') {
        this._onDashBreak(o)
        this.obs.splice(i, 1)
        continue
      } else if (result === 'collision') {
        this._takeDamage()
      }

      if (o.offscreen) this.obs.splice(i, 1)
    }
  }

  _updateKasta() {
    const kasta = getKastaDef(this.dist)
    if (kasta.id !== this._lastKastaId) {
      this._lastKastaId = kasta.id
      this.game.events?.emit(EVENTS.KASTA_UP, { id: kasta.id, label: kasta.label })
      this.game.floats.push(
        new FloatText(kasta.label, this.game.width / 2, this.game.height * 0.4, COLORS.gold, 28),
      )
    }
  }

  _onNearMiss() {
    const kasta = getKastaDef(this.dist)
    const { combo, mult } = this.combo.gain(kasta)
    const p = this.player
    const S = this.game.scale
    this.game.floats.push(
      new FloatText(nearMissText(combo), p.x + p.w / 2, p.y - 40 * S, COLORS.gold, Math.round(28 * S)),
    )
    this.game.shake.trigger(5 * S, 0.18)
    this.game.events?.emit(EVENTS.NEAR_MISS, { combo, mult })
  }

  // Player dashed through a mid-zone door — the door breaks. Rewarded as a
  // verb-chain bonus (same as a near-miss) so dashes through traffic feel good.
  _onDashBreak(obstacle) {
    const kasta = getKastaDef(this.dist)
    const { combo, mult } = this.combo.gain(kasta)
    const S = this.game.scale
    this.game.floats.push(
      new FloatText('CRASH!', obstacle.x + obstacle.w / 2, obstacle.y, COLORS.accent, Math.round(32 * S)),
    )
    this.game.shake.trigger(8 * S, 0.25)
    this.game.events?.emit(EVENTS.NEAR_MISS, { combo, mult, source: 'dash-break' })
  }

  _takeDamage() {
    this.lives--
    const hadCombo = this.combo.clear()
    this.player.hit(INVINCIBLE_TIME)
    const S = this.game.scale
    this.game.shake.trigger(12 * S, 0.3)
    const p = this.player
    this.game.floats.push(new FloatText('AW!', p.x + p.w / 2, p.y - 20 * S, COLORS.accent, Math.round(28 * S)))
    this.game.events?.emit(EVENTS.PLAYER_HIT, { lives: this.lives })

    if (this.lives <= 0) {
      this.alive = false
      this.deathTimer = DEATH_DELAY
      this.game.events?.emit(EVENTS.PLAYER_DEATH, { dist: Math.floor(this.dist), hadCombo })
    }
  }

  _spawnFloats(requests) {
    for (const r of requests) {
      this.game.floats.push(new FloatText(r.text, r.x, r.y, r.color, r.size))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  draw(ctx) {
    const { width: W, height: H } = this.game
    const kasta = getKastaDef(this.dist)
    ctx.fillStyle = KASTA_BG[kasta.label] ?? kasta.bg
    ctx.fillRect(0, 0, W, H)
    this.game.drawFloor(ctx)

    this.obs.forEach((o) => o.draw(ctx))
    this.player.draw(ctx)

    this.hud.draw(ctx, this.game, {
      lives: this.lives,
      dist: this.dist,
      combo: this.combo.combo,
      mult: this.combo.mult,
      kastaLabel: kasta.label,
      dashCd: this.player.dashCd,
      showControls: this.showControls,
    })
  }
}
