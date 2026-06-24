// ─── Obstacles ──────────────────────────────────────────────────────────────────
//
// Each def carries a `minKasta` (tier index) so SpawnDirector can grow the pool
// as the player advances kasta (GDD §VI). Tier 0 = Kipas Angin (tutorial-safe,
// all three verbs), 1 = AC Standar, 2 = Singgahsini, 3 = Kos Impian (everything).
import { GAME_HEIGHT, PLAYER_HEIGHT } from '../constants.js'
import { roundRect } from '../core/utils.js'

// Design-baseline sizes (at 390px width)
const SLIDE_CLEARANCE = 8

const OBS_DEFS = [
  {
    id: 'ember',
    zone: 'floor',
    minKasta: 0,
    w: 48,
    h: 48,
    fill: '#3498db',
    label: 'EMBER\n(JUMP)',
    getY: (floorY) => floorY - 48,
  },
  {
    id: 'kucing',
    zone: 'floor',
    minKasta: 0,
    w: 72,
    h: 40,
    fill: '#f39c12',
    label: 'KUCING\n(JUMP)',
    getY: (floorY) => floorY - 40,
  },
  {
    id: 'jemuran',
    zone: 'ceiling',
    minKasta: 0,
    w: 88,
    h: 36,
    fill: '#9b59b6',
    label: 'JEMURAN\n(SLIDE)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 36 - SLIDE_CLEARANCE,
  },
  // Flying slide obstacles (replaces the old floor-sitting shelves). A thing
  // hurtling at head height unambiguously reads as "duck under" — unlike a rak,
  // which sits on the floor and reads as JUMP, breaking the §III one-verb
  // telegraph. They travel HORIZONTALLY at a fixed head-height Y (speedScale
  // makes them arrive faster = "thrown/incoming"); the draw-only bob in the
  // Obstacle class never touches bounds, so the correct verb never changes
  // mid-approach (vertical motion would — that's the ambiguity §III forbids).
  {
    id: 'burung',
    zone: 'ceiling',
    minKasta: 0,
    w: 40,
    h: 28,
    fill: '#5dade2',
    label: 'BURUNG\n(SLIDE)',
    speedScale: 1.15,
    bob: true, // cosmetic flap; draw-only
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 28 - SLIDE_CLEARANCE,
  },
  {
    id: 'sandal_lempar',
    zone: 'ceiling',
    minKasta: 0,
    w: 34,
    h: 20,
    fill: '#e67e22',
    label: 'SANDAL\n(SLIDE)',
    speedScale: 1.2, // light + slightly faster — Ibu Kos chucks it at your head
    bob: true,
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 20 - SLIDE_CLEARANCE,
  },
  {
    id: 'pintu',
    zone: 'mid',
    minKasta: 0,
    w: 32,
    // Height proportional to screen — same ratio as design baseline (0.38 of GAME_HEIGHT)
    get h() {
      return Math.round(GAME_HEIGHT * 0.38)
    },
    fill: '#c0392b',
    label: 'PINTU\n(DASH)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - Math.round(GAME_HEIGHT * 0.38) - SLIDE_CLEARANCE,
  },
  // AC Standar additions (GDD §VI.2).
  {
    id: 'galon',
    zone: 'floor',
    minKasta: 1,
    w: 40,
    h: 64,
    fill: '#1abc9c',
    label: 'GALON\n(JUMP)',
    // "Moving" in the GDD = horizontal oscillation; placeholder keeps it static
    // for now, the oscillation is a Phase 2 visual polish on this same def.
    getY: (floorY) => floorY - 64,
  },
  {
    id: 'galon_lempar',
    zone: 'ceiling',
    minKasta: 1,
    w: 40,
    h: 44,
    fill: '#16a085',
    label: 'GALON\n(SLIDE)',
    // Heavier object → barely above world speed so the bigger hitbox isn't
    // unfair to react to.
    speedScale: 1.1,
    bob: true,
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - 44 - SLIDE_CLEARANCE,
  },
  // Singgahsini additions (GDD §VI.3).
  {
    id: 'monstera',
    zone: 'floor',
    minKasta: 2,
    w: 92,
    h: 80,
    fill: '#27ae60',
    label: 'MONSTERA\n(JUMP)',
    // "Visual blocker": wider footprint so it briefly hides oncoming traffic.
    getY: (floorY) => floorY - 80,
  },
]

// Kasta-twist obstacles, spawned by name (not in the random pool). Singgahsini's
// vacuum chases the floor lane and is read as a JUMP threat. The smart-lock is
// a mid-zone door that REQUIRES dash (GDD §VI.3 "smart-lock butuh dash"). Both
// injected by SpawnDirector when the active kasta's mechanic flag is on.
const SPECIAL_DEFS = {
  vacuum: {
    id: 'vacuum',
    zone: 'floor',
    w: 56,
    h: 26,
    fill: '#34495e',
    label: 'VACUUM\n(JUMP)',
    getY: (floorY) => floorY - 26,
  },
  smartlock: {
    id: 'smartlock',
    zone: 'mid',
    w: 36,
    get h() {
      return Math.round(GAME_HEIGHT * 0.42)
    },
    fill: '#2c3e50',
    label: 'SMART-LOCK\n(DASH)',
    getY: (floorY) => floorY - PLAYER_HEIGHT / 2 - Math.round(GAME_HEIGHT * 0.42) - SLIDE_CLEARANCE,
  },
}

export class Obstacle {
  constructor(def, game) {
    const S = game.scale
    const floorY = game.floorY

    this.game = game
    this.id = def.id // asset lookup key → 'obs:<id>' in the manifest
    // Scale all dimensions
    this.w = Math.round(def.w * S)
    this.h = Math.round(def.h * S)
    // getY operates in design space, then we scale the result
    const designFloorY = floorY / S // convert runtime floorY back to design space for getY
    this.y = Math.round(def.getY(designFloorY) * S)
    this.x = game.width + this.w
    this.fill = def.fill
    this.label = def.label
    this.zone = def.zone
    // Per-obstacle scroll multiplier. Flying objects (>1) arrive faster so they
    // read as thrown/incoming; ground obstacles default to 1 (world speed).
    this.speedScale = def.speedScale ?? 1
    // Cosmetic vertical bob (draw-only). NEVER applied to bounds/collision, so
    // the slide verb stays unambiguous regardless of the wobble.
    this._bobOn = !!def.bob
    this._bob = 0
    this.passed = false
    this.nearMissed = false
    // "Mental" state: when a Kopi-boosted player rams it, the obstacle is flung
    // out (velocity + spin + fade) instead of scrolling. Collision is disabled
    // while knocked (see CollisionSystem) and the scene drops it once offscreen.
    this.knocked = false
    this._kvx = 0
    this._kvy = 0
    this._krot = 0
    this._krotV = 0
    this._kfade = 1
    this._labelSize = Math.round(11 * S)
    this._labelLineH = Math.round(13 * S)
  }

  // Pick a random obstacle from the pool available at the given kasta tier.
  // `tier` is the active kasta index (0=Kipas Angin, 1=AC Standar, ...). defs
  // with minKasta ≤ tier are eligible. Defaults to 0 so uncalled uses still
  // return the tutorial-safe pool.
  //
  // Selection is VERB-BALANCED, not flat-uniform: pick a zone (verb) first with
  // weighted-by-zone, then a def within it. A flat pick over defs would skew
  // toward whichever verb has the most variants (today: 4 floor/JUMP,
  // 4 ceiling/SLIDE, 1 mid/DASH). Picking the zone first keeps all three verbs
  // alive regardless of variant count.
  //
  // Zone weights (not equal): JUMP is the most comfortable verb, so floor gets
  // the largest share; SLIDE obstacles are flying objects that arrive faster, so
  // ceiling is kept lower to avoid relentless duck-spam; DASH stays modest. This
  // tilts the run toward the easy verb instead of an even 1/3 split that felt
  // punishing once slide became flying objects. Zones absent at this tier are
  // dropped and their weight ignored.
  static random(game, tier = 0) {
    const pool = OBS_DEFS.filter((d) => d.minKasta <= tier)
    const ZONE_WEIGHT = { floor: 5, ceiling: 3, mid: 2 }
    const zones = [...new Set(pool.map((d) => d.zone))]
    const total = zones.reduce((s, z) => s + (ZONE_WEIGHT[z] ?? 1), 0)
    let r = Math.random() * total
    let zone = zones[0]
    for (const z of zones) {
      r -= ZONE_WEIGHT[z] ?? 1
      if (r <= 0) { zone = z; break }
    }
    const inZone = pool.filter((d) => d.zone === zone)
    const def = inZone[Math.floor(Math.random() * inZone.length)]
    return new Obstacle(def, game)
  }

  // Build a named kasta-twist obstacle (e.g. 'vacuum'). Returns null if unknown.
  static special(id, game) {
    const def = SPECIAL_DEFS[id]
    return def ? new Obstacle(def, game) : null
  }

  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h }
  }

  // Fling the obstacle out (Kopi smash). Forward-up arc + spin + fade, with a
  // little random spread so a string of smashes doesn't look identical.
  knockAway() {
    const S = this.game.scale
    this.knocked = true
    // Forward (right) + up, scaled to the frame. Random spread on each axis.
    this._kvx = (260 + Math.random() * 220) * S
    this._kvy = -(360 + Math.random() * 200) * S
    this._krotV = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6)
    this._kfade = 1
  }

  update(dt, speed) {
    if (this.knocked) {
      const S = this.game.scale
      this._kvy += 1400 * S * dt // gravity pulls the arc back down
      this.x += this._kvx * dt
      this.y += this._kvy * dt
      this._krot += this._krotV * dt
      this._kfade = Math.max(0, this._kfade - dt * 1.6)
      return
    }
    this.x -= speed * this.speedScale * dt
    if (this._bobOn) this._bob += dt * 9
  }

  get offscreen() {
    if (this.knocked) {
      // Gone once it has faded out or flown well past any edge.
      return this._kfade <= 0 || this.x > this.game.width + 200 || this.y > this.game.height + 200
    }
    return this.x + this.w < -100
  }

  draw(ctx) {
    // Knocked-away (Kopi smash): spin + fade about the center. Wrap the normal
    // draw in a transform so sprite/placeholder paths stay unchanged.
    if (this.knocked) {
      ctx.save()
      ctx.globalAlpha = this._kfade
      const cx = this.x + this.w / 2
      const cy = this.y + this.h / 2
      ctx.translate(cx, cy)
      ctx.rotate(this._krot)
      ctx.translate(-cx, -cy)
      this._drawBody(ctx, this.y)
      ctx.restore()
      return
    }
    // Draw-only bob: shifts the sprite a few px vertically so flying objects
    // flutter. Collision still uses this.y (bounds), so the verb never changes.
    const yb = this._bobOn ? this.y + Math.sin(this._bob) * (this.h * 0.18) : this.y
    this._drawBody(ctx, yb)
  }

  // Sprite-first body draw at a given top Y (yb). Split out so the knocked-away
  // transform can reuse the exact same sprite/placeholder logic.
  _drawBody(ctx, yb) {
    // Sprite-first (GDD §XVI Step 4). drawImage stretches the art to the
    // collision rect (this.w × this.h). Tall obstacles (pintu, smartlock) are
    // authored at an AI-friendly ratio and stretched vertically here — their art
    // is designed to tolerate it (horizontal cracks, vertical wood grain).
    const assets = this.game?.assets
    const id = this.id ? `obs:${this.id}` : null
    const sprite = id && assets?.has(id) ? assets.image(id) : null
    if (sprite) {
      ctx.drawImage(sprite, this.x, yb, this.w, this.h)
      return
    }

    // Placeholder: colored rounded block + zone/verb label.
    ctx.fillStyle = this.fill
    roundRect(ctx, this.x, yb, this.w, this.h, 4)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    roundRect(ctx, this.x, yb + this.h - 5, this.w, 5, 4)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${this._labelSize}px monospace`
    ctx.textAlign = 'center'
    this.label.split('\n').forEach((line, i) => {
      ctx.fillText(
        line,
        this.x + this.w / 2,
        yb + this.h / 2 - this._labelLineH / 2 + i * this._labelLineH
      )
    })
  }
}
