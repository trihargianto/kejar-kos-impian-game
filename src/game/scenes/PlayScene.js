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
import {
  BASE_SPEED,
  SPEED_RAMP,
  INVINCIBLE_TIME,
  DEATH_DELAY,
  KOPI_SPEED_MULTIPLIER,
} from '../constants.js'
import { KASTA_BG } from '../theme.js'
import { COLORS } from '../theme.js'
import { FloatText } from '../entities/FloatText.js'
import { Shard } from '../entities/Shard.js'
import { Player } from '../entities/Player.js'
import { SandalProjectile } from '../entities/SandalProjectile.js'
import { INTENT } from '../core/Input.js'
import { getKastaDef } from '../kasta.js'
import { nearMissText } from '../systems/score.js'
import { budgetFromCoins } from '../systems/dreamKos.js'
import { activeDifficulty } from '../systems/settings.js'
import { EVENTS } from '../core/EventBus.js'
import { SpawnDirector } from './play/SpawnDirector.js'
import { ComboSystem } from './play/ComboSystem.js'
import { CollectibleDirector } from './play/CollectibleSystem.js'
import { PromptDirector } from './play/PromptDirector.js'
import { HorizonGoal } from './play/HorizonGoal.js'
import { GroundPanel } from './play/GroundPanel.js'
import { Background } from './play/Background.js'
import { Hud } from './play/Hud.js'
import { testObstacle, scaledNearMissDist } from './play/CollisionSystem.js'

export class PlayScene {
  constructor(game) {
    this.game = game
    this.player = new Player(game)
    // Wire player → event bus so jump/slide/dash can drive audio + analytics
    // without the scene shuttling each call manually.
    this.player._emit = (kind) => {
      const map = {
        jump: EVENTS.PLAYER_JUMP,
        land: EVENTS.PLAYER_LAND,
        slide: EVENTS.PLAYER_SLIDE,
        dash: EVENTS.PLAYER_DASH,
      }
      if (kind === 'jump') {
        // jumps was already decremented before _emit — if 0 left it was the double jump.
        this.game.events?.emit(EVENTS.PLAYER_JUMP, { double: this.player.jumps === 0 })
        return
      }
      if (map[kind]) this.game.events?.emit(map[kind])
    }

    this.spawner = new SpawnDirector()
    this.combo = new ComboSystem()
    this.collectibles = new CollectibleDirector()
    this.prompts = new PromptDirector()
    this.horizon = new HorizonGoal()
    this.groundPanel = new GroundPanel()
    this.background = new Background()
    this.hud = new Hud()
    this.obs = []
    this.coins = 0
    this.sandals = [] // active Sandal Jepit projectiles in flight
    this.activePrompt = null
    this._promptTimer = 0
    this._lastKastaId = null
  }

  enter() {
    const kasta = getKastaDef(0)
    // Snapshot the difficulty preset for the whole run, so changing it mid-run
    // (in Settings) only takes effect next run. Medium = all multipliers 1.0.
    this.diff = activeDifficulty()
    this.dist = 0
    this.score = 0
    this.spd = BASE_SPEED * this.diff.speed
    this.lives = this.diff.lives
    this.alive = true
    this.deathTimer = 0
    this.obs = []
    this.coins = 0
    this.sandals = []
    this.activePrompt = null
    this._promptTimer = 0
    this._flashTimer = 0
    this._flashColor = null
    this.spawner.reset()
    this.combo.reset()
    this.collectibles.reset()
    this.prompts.reset()
    this.player.reset()
    this.game.floats.length = 0
    this._lastKastaId = kasta.id
    this._flashTimer = 0
    this._flashColor = null
    this.game.events?.emit(EVENTS.GAME_START)
  }

  update(dt) {
    if (!this.alive) {
      this.deathTimer -= dt
      if (this.deathTimer <= 0) {
        this.game.lastDist = Math.floor(this.dist)
        this.game.lastCoins = this.coins
        this.game.lastScore = Math.floor(this.score)
        // §IX reveal reads coins (budget) + distance (tier) at game over.
        this.game.events?.emit(EVENTS.GAME_OVER, {
          dist: this.game.lastDist,
          coins: this.coins,
          score: this.game.lastScore,
        })
        this.game.go('gameover')
      }
      return
    }

    this._updateSpeed()
    this._updateDistance(dt)
    this._handleInput()
    const wasBoosting = this.player.boosting
    this.player.update(dt)
    if (wasBoosting && !this.player.boosting) {
      this.game.events?.emit(EVENTS.BOOST_END)
    }
    this._updateSpawning(dt)
    this._updateObstacles(dt)
    this._updateCollectibles(dt)
    this._updateSandals(dt)
    this.combo.update(dt)
    this._updateKasta()
    this._updatePrompts(dt)
    if (this._flashTimer > 0) this._flashTimer -= dt
  }

  // ── Sub-steps ───────────────────────────────────────────────────────────────
  _updateSpeed() {
    // Per-kasta speedMultiplier (GDD §VI) layers on the base distance ramp, so
    // each tier genuinely feels faster, not just re-skinned. Kopi Sachet boost
    // (GDD §VII Passive) layers on top of that as a temporary multiplier.
    const kasta = getKastaDef(this.dist)
    const boostMult = this.player.boosting ? KOPI_SPEED_MULTIPLIER : 1
    // Difficulty scales the base speed + the ramp (acceleration) independently.
    const d = this.diff
    this.spd =
      (BASE_SPEED * d.speed + (this.dist / 10) * SPEED_RAMP * d.ramp) *
      (kasta.speedMultiplier ?? 1) *
      boostMult
    // Feed the kasta's friction into the player so lantai licin lengthens dashes.
    this.player.friction = kasta.frictionMultiplier ?? 1
    // Share world speed so the run-cycle animation paces its legs to the ground.
    this.player.worldSpeed = this.spd
  }

  _updateDistance(dt) {
    // Integrate distance (m) from speed, then accumulate score = meters × live
    // combo multiplier. A near-miss that raises the multiplier pays out for
    // every subsequent meter, so an aggressive short run outscores a cautious
    // long one. (GDD §IV: skor = jarak × combo multiplier.)
    const dM = (this.spd / 200) * dt
    this.dist += dM
    this.score += dM * this.combo.mult
  }

  _handleInput() {
    const input = this.game.input

    // One jump per frame. Two physical taps land in different frames (frames are
    // ~16ms, a human double-tap is far slower), so each becomes its own jump and
    // the second is the double jump. Firing more than once per frame would burn
    // both jumps on a single tap, so we deliberately do NOT drain.
    if (input.anyPressed(INTENT.jump)) {
      this._spawnFloats(this.player.jump())
    }
    // Slide: the press edge enters/refreshes the slide (with float + audio);
    // holding the button keeps it alive each frame (quiet refresh, no spam).
    if (input.anyPressed(INTENT.slide)) {
      this._spawnFloats(this.player.slide())
    } else if (input.anyDown(INTENT.slide)) {
      this.player.holdSlide()
    }
    if (input.anyPressed(INTENT.dash)) {
      this._spawnFloats(this.player.dash())
    }
    // Sandal Jepit (active power-up, GDD §VII). Throw is gated by ammo.
    if (input.anyPressed(INTENT.throw)) {
      this._throwSandal()
    }
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
      } else if (result === 'kopi-smash') {
        // Don't splice — knockAway lets it fly; the offscreen check below drops it.
        this._onKopiSmash(o)
      } else if (result === 'collision') {
        this._takeDamage()
      }

      if (o.offscreen) this.obs.splice(i, 1)
    }
  }

  // Recehan (GDD §VII). Coins feed the combo (a near-miss-like reward) and the
  // §IX budget (currency → rupiah band at game over). Power-ups (Kopi Sachet
  // passive + Sandal Jepit active) apply on pickup.
  _updateCollectibles(dt) {
    const S = this.game.scale
    // Spawn first (cadence + greed placement near upcoming obstacles), then
    // scroll + resolve pickups. Spawn reads this.obs so coins land near traffic.
    this.collectibles.spawn(dt, this.game, this.obs)
    const { coins, powerups, hearts } = this.collectibles.update(
      dt,
      this.spd * S,
      this.player.bounds
    )

    if (coins > 0) {
      this.coins += coins
      const kasta = getKastaDef(this.dist)
      const { combo, mult } = this.combo.gain(kasta) // greed pays into the combo loop
      const p = this.player
      this.game.floats.push(
        new FloatText(`+${coins}`, p.x + p.w / 2, p.y - 50 * S, COLORS.gold, Math.round(20 * S))
      )
      this.game.events?.emit(EVENTS.COLLECT_COIN, { coins, total: this.coins })
      this.game.events?.emit(EVENTS.COMBO_GAIN, { combo, mult })
    }

    if (hearts > 0) {
      this._applyHeart()
    }

    for (const kind of powerups) {
      if (kind === 'kopi') this._applyKopi()
      else if (kind === 'sandal') this._applySandal()
    }
  }

  // Heart collectible: restore 1 life, capped at the difficulty's max lives.
  _applyHeart() {
    const maxLives = this.diff.lives
    if (this.lives >= maxLives) return // already full — silently skip
    this.lives++
    const S = this.game.scale
    const p = this.player
    this.game.floats.push(
      new FloatText('+1 NYAWA!', p.x + p.w / 2, p.y - 40 * S, '#e74c3c', Math.round(26 * S))
    )
    // Gentle pink flash + light shake — celebratory, not alarming.
    this._flashColor = 'rgba(231,76,60,0.22)'
    this._flashTimer = 0.35
    this.game.shake.trigger(4 * S, 0.18)
    this.game.events?.emit(EVENTS.COLLECT_HEART, { lives: this.lives })
  }

  // Full-screen color overlay fades out over its timer window.
  _drawFlash(ctx) {
    const alpha = this._flashTimer / 0.35
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this._flashColor
    ctx.fillRect(0, 0, this.game.width, this.game.height)
    ctx.restore()
  }

  // Kopi Sachet (passive, GDD §VII). Player.applyKopi extends both the boost
  // window and the i-frame window, so near-miss keeps firing AND damage is
  // skipped for the same 5s.
  _applyKopi() {
    const { started } = this.player.applyKopi()
    const S = this.game.scale
    const p = this.player
    this.game.floats.push(
      new FloatText('KOPI!', p.x + p.w / 2, p.y - 40 * S, '#6c3483', Math.round(24 * S))
    )
    this.game.events?.emit(EVENTS.COLLECT_KOPI)
    if (started) this.game.events?.emit(EVENTS.BOOST_START)
  }

  // Sandal Jepit (active, GDD §VII). Pickup resets ammo to SANDAL_AMMO; the
  // player throws via INTENT.throw (see _throwSandal).
  _applySandal() {
    const ammo = this.player.applySandalAmmo()
    const S = this.game.scale
    const p = this.player
    this.game.floats.push(
      new FloatText(`SANDAL ×${ammo}`, p.x + p.w / 2, p.y - 40 * S, '#2980b9', Math.round(22 * S))
    )
    this.game.events?.emit(EVENTS.COLLECT_SANDAL, { ammo })
  }

  // Sandal Jepit throw (GDD §VII). Spawn a visible SandalProjectile that flies
  // from the player toward the nearest upcoming obstacle. Impact (combo gain,
  // shake, float, obstacle destroy) is applied when the projectile lands in
  // _onSandalImpact, NOT here — that way the player sees the throw travel.
  _throwSandal() {
    if (!this.player.consumeSandal()) {
      this.game.events?.emit(EVENTS.SANDAL_EMPTY)
      return
    }

    // Obstacles already claimed by an in-flight sandal are skipped, otherwise
    // two quick throws would both lock onto the same nearest obstacle and the
    // second sandal would silently expire into nothing once the first one
    // destroyed it (the "only 2 throws worked" bug).
    const claimed = new Set()
    for (const s of this.sandals) if (s.target) claimed.add(s.target)

    // Lock onto the nearest unclaimed upcoming obstacle. If there's nothing
    // eligible, refund the ammo (don't punish a premature trigger; the player
    // can try again next frame).
    const target = this._pickSandalTarget(claimed)
    if (!target) {
      this.player.sandals++ // refund — nothing to throw at
      return
    }

    this.sandals.push(new SandalProjectile(this.game, this.player.bounds, target))
  }

  // Nearest obstacle ahead of the player that hasn't been resolved and isn't
  // claimed by another in-flight sandal. Pure relative to (this.obs, claimed).
  _pickSandalTarget(claimed = new Set()) {
    let target = null
    let bestDist = Infinity
    const rightEdge = this.player.x + this.player.w
    for (const o of this.obs) {
      if (o.passed || o.nearMissed || o.knocked) continue
      if (claimed.has(o)) continue
      const d = o.x - rightEdge
      if (d > 0 && d < bestDist) {
        target = o
        bestDist = d
      }
    }
    return target
  }

  // Step every active sandal projectile. On impact, apply the small combo
  // reward + VFX (mirrors the old instant-destroy path). Off-screen expirations
  // and target-lost paths just clean up silently.
  _updateSandals(dt) {
    for (let i = this.sandals.length - 1; i >= 0; i--) {
      const s = this.sandals[i]
      const result = s.update(dt, this.game, this.obs)
      if (result?.hit) this._onSandalImpact(result.obstacle)
      if (s.dead) this.sandals.splice(i, 1)
    }
  }

  // Impact: small combo reward (gainSmall — combo++ but no mult boost, so
  // near-miss stays strictly better for score). Float + shake communicate
  // the hit at the obstacle's final position.
  _onSandalImpact(obstacle) {
    const kasta = getKastaDef(this.dist)
    const { combo, mult } = this.combo.gainSmall(kasta)
    const S = this.game.scale
    // Doors (mid) shatter and are removed; everything else gets knocked away
    // ("mental") and left in the array to fly out (the offscreen check culls it).
    if (obstacle.zone === 'mid') {
      this._spawnShatter(obstacle)
      const idx = this.obs.indexOf(obstacle)
      if (idx >= 0) this.obs.splice(idx, 1)
      this.game.events?.emit(EVENTS.DOOR_BREAK)
    } else {
      obstacle.knockAway()
    }
    this.game.floats.push(
      new FloatText(
        'SANDAL!',
        obstacle.x + obstacle.w / 2,
        obstacle.y,
        COLORS.accent,
        Math.round(22 * S)
      )
    )
    this.game.shake.trigger(6 * S, 0.18)
    this.game.events?.emit(EVENTS.SANDAL_THROW, { combo, mult })
  }

  _updateKasta() {
    const kasta = getKastaDef(this.dist)
    if (kasta.id !== this._lastKastaId) {
      this._lastKastaId = kasta.id
      // Full heal on kasta up — reward for reaching the next tier.
      this.lives = this.diff.lives
      this._flashColor = 'rgba(231,76,60,0.18)'
      this._flashTimer = 0.4
      this.game.events?.emit(EVENTS.KASTA_UP, { id: kasta.id, label: kasta.label })
      this.game.floats.push(
        new FloatText(kasta.label, this.game.width / 2, this.game.height * 0.4, COLORS.gold, 28)
      )
      this.game.floats.push(
        new FloatText('NYAWA PENUH!', this.game.width / 2, this.game.height * 0.48, '#e74c3c', 22)
      )
      // 1000m gate: entering endless Mode Kos Impian is its own beat (§VI.4).
      if (kasta.mechanics?.endless) {
        this.game.events?.emit(EVENTS.IMPIAN_GATE, { dist: Math.floor(this.dist) })
        this.game.floats.push(
          new FloatText(
            'MODE KOS IMPIAN!',
            this.game.width / 2,
            this.game.height * 0.32,
            COLORS.accent,
            26
          )
        )
      }
    }
  }

  // Milestone story prompts (GDD §VIII). Show for a few seconds then fade out.
  _updatePrompts(dt) {
    const fired = this.prompts.check(this.dist)
    if (fired) {
      this.activePrompt = fired
      this._promptTimer = 3.2
      this.game.events?.emit(EVENTS.PROMPT, { text: fired })
    }
    if (this._promptTimer > 0) {
      this._promptTimer -= dt
      if (this._promptTimer <= 0) this.activePrompt = null
    }
  }

  _onNearMiss() {
    const kasta = getKastaDef(this.dist)
    const { combo, mult } = this.combo.gain(kasta)
    const p = this.player
    const S = this.game.scale
    this.game.floats.push(
      new FloatText(
        nearMissText(combo),
        p.x + p.w / 2,
        p.y - 40 * S,
        COLORS.gold,
        Math.round(28 * S)
      )
    )
    this.game.shake.trigger(5 * S, 0.18)
    this.game.freezeFor(0.05) // hit-stop so "Nyaris!" punches (GDD §XIII)
    this.game.events?.emit(EVENTS.NEAR_MISS, { combo, mult })
    this.game.events?.emit(EVENTS.COMBO_GAIN, { combo, mult })
  }

  // Player dashed through a mid-zone door — the door breaks. Rewarded as a
  // verb-chain bonus (same as a near-miss) so dashes through traffic feel good.
  _onDashBreak(obstacle) {
    const kasta = getKastaDef(this.dist)
    const { combo, mult } = this.combo.gain(kasta)
    const S = this.game.scale
    // Shatter burst in the door's own colour so it visibly breaks apart instead
    // of just vanishing (the splice that removes it happens in _updateObstacles).
    this._spawnShatter(obstacle)
    this.game.floats.push(
      new FloatText(
        'CRASH!',
        obstacle.x + obstacle.w / 2,
        obstacle.y,
        COLORS.accent,
        Math.round(32 * S)
      )
    )
    this.game.shake.trigger(8 * S, 0.25)
    this.game.freezeFor(0.06) // a smashed door lands harder than a graze
    this.game.events?.emit(EVENTS.DOOR_BREAK)
    this.game.events?.emit(EVENTS.NEAR_MISS, { combo, mult, source: 'dash-break' })
  }

  // Debris spray when a breakable (door) shatters. Centered on the obstacle,
  // tinted to its fill, scaled to the frame. Pushed into floats so the main
  // loop updates/renders/culls them with no extra plumbing.
  _spawnShatter(obstacle) {
    const cx = obstacle.x + obstacle.w / 2
    const cy = obstacle.y + obstacle.h / 2
    const color = obstacle.fill || COLORS.accent
    const shards = Shard.burst(cx, cy, color, this.game.scale, 12)
    for (const s of shards) this.game.floats.push(s)
  }

  // Kopi-boosted player rammed a non-door obstacle (GDD §VII). The obstacle is
  // flung out ("mental") with VFX but grants NO combo — Kopi immunity must not
  // become a passive combo farm (just hold Kopi and bulldoze everything). Near-
  // miss and dash-break stay the only ways to build the multiplier.
  _onKopiSmash(obstacle) {
    obstacle.knockAway()
    const S = this.game.scale
    this.game.floats.push(
      new FloatText(
        'GASAK!',
        obstacle.x + obstacle.w / 2,
        obstacle.y,
        COLORS.accent,
        Math.round(28 * S)
      )
    )
    this.game.shake.trigger(7 * S, 0.2)
    this.game.freezeFor(0.04) // light punch, lighter than a dash-break
    this.game.events?.emit(EVENTS.KOPI_SMASH, { id: obstacle.id })
  }

  _takeDamage() {
    this.lives--
    const hadCombo = this.combo.clear()
    this.player.hit(INVINCIBLE_TIME * this.diff.iframes)
    const S = this.game.scale
    this.game.shake.trigger(12 * S, 0.3)
    this.game.freezeFor(0.07) // damage hit-stop — heaviest beat
    const p = this.player
    this.game.floats.push(
      new FloatText('AW!', p.x + p.w / 2, p.y - 20 * S, COLORS.accent, Math.round(28 * S))
    )
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
    // Fill the whole frame with the kasta tint first so the floor band + any
    // gap under a not-yet-loaded background still has the tier colour.
    const kasta = getKastaDef(this.dist)
    ctx.fillStyle = KASTA_BG[kasta.label] ?? kasta.bg
    ctx.fillRect(0, 0, W, H)
    // Parallax hallway wall over the sky band (sprite-first, falls back to the
    // flat tint). Scrolls slower than the foreground for depth.
    this.background.draw(ctx, this.game, this.dist)
    // Horizon goal sits between sky and floor — the dream kos you're chasing.
    this.horizon.draw(ctx, this.game, this.dist)
    this.game.drawFloor(ctx)
    // Ground-strip panels (scrolling detail + coin badge + tier progress) fill
    // the bottom-left space freed by the raised floor. Drawn on the floor, under
    // obstacles/player so a passing obstacle still reads above the panel.
    this.groundPanel.draw(ctx, this.game, {
      dist: this.dist,
      coins: this.coins,
      budget: budgetFromCoins(this.coins),
      boostTimer: this.player.boostTimer,
    })

    this.collectibles.draw(ctx)
    this.obs.forEach((o) => o.draw(ctx))
    // Sandal projectiles fly in front of obstacles so the throw reads clearly
    // even when traffic is dense. Drawn behind the player so the launch point
    // (the player's right hand) stays visually anchored.
    this.sandals.forEach((s) => s.draw(ctx))
    this.player.draw(ctx)

    this.hud.draw(ctx, this.game, {
      lives: this.lives,
      maxLives: this.diff.lives,
      dist: this.dist,
      score: this.score,
      combo: this.combo.combo,
      mult: this.combo.mult,
      decay: this.combo.decayFraction,
    })

    if (this.activePrompt) this._drawPrompt(ctx)
    if (this._flashTimer > 0 && this._flashColor) this._drawFlash(ctx)
  }

  // Milestone story prompt — a fading banner near the upper third.
  _drawPrompt(ctx) {
    const { width: W, height: H, scale: S } = this.game
    const alpha = Math.min(1, this._promptTimer / 0.6) // fade out in the last 0.6s
    ctx.save()
    ctx.globalAlpha = alpha

    const padX = 16 * S
    const padY = 10 * S
    const lineH = 22 * S
    ctx.font = `bold ${Math.round(15 * S)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Word-wrap to fit the frame width (the prompt is a full sentence and used to
    // overflow off both edges on narrow screens). Banner height grows per line.
    const maxTextW = W - padX * 4
    const lines = wrapText(ctx, this.activePrompt, maxTextW)
    const boxW = Math.min(
      W - padX * 2,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2
    )
    const boxH = lines.length * lineH + padY * 2
    const cyTop = H * 0.2 - boxH / 2

    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.beginPath()
    ctx.roundRect(W / 2 - boxW / 2, cyTop, boxW, boxH, 8 * S)
    ctx.fill()

    ctx.fillStyle = '#fff'
    lines.forEach((l, i) => {
      ctx.fillText(l, W / 2, cyTop + padY + lineH * (i + 0.5))
    })
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }
}

// Greedy word-wrap: split `text` into lines that each fit within maxW at the
// context's current font. A single word longer than maxW stays on its own line
// (it'll still fit on any realistic phone width for these prompts).
function wrapText(ctx, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}
