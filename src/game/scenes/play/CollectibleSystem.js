// ─── Collectible director ─────────────────────────────────────────────────────
// Spawns Recehan (coins) + Item Kos Impian (facility tags), scrolls them, and
// resolves pickups against the player. Owns the dream-kos profile (which tags
// the player grabbed this run) so the §IX reveal can read it at game over.
//
// Greed placement (GDD §VII): coins sit in the floor/ceiling lanes near where
// obstacles travel, so the most profitable line is also the riskiest. Items are
// rarer and float mid-air to pull the player off a safe path.
import { PLAYER_HEIGHT, JUMP_VELOCITY, GRAVITY } from '../../constants.js'
import { Collectible, FACILITY_TAGS } from '../../entities/Collectible.js'

const COIN_INTERVAL = 0.9 // base seconds between coin spawns
const ITEM_INTERVAL = 6.0 // base seconds between dream-kos item spawns
const CLEARANCE = 16 // design-px gap kept between any collectible and obstacle

// Lanes are computed at RUNTIME from game.floorY, NOT from raw design constants.
// game.floorY is a height-ratio of the actual canvas, so on any non-390×844
// canvas (e.g. true 9:16 = 390×693) `designY * scale` lands far below the
// player — that was the "coins below the player" bug. Anchoring every lane to
// the real floor + the real jump apex keeps coins grabbable at any aspect.
//   ground center = floorY - PLAYER_HEIGHT/2 · S   (where the runner sits)
//   apex up       = JUMP_VELOCITY²/(2·GRAVITY) · S (max single-jump rise)
function lanesFor(game) {
  const S = game.scale
  const groundCenter = game.floorY - (PLAYER_HEIGHT / 2) * S
  const apexUp = ((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY)) * S
  return {
    FLOOR: groundCenter, // grab while running
    MID: groundCenter - apexUp * 0.55, // comfortable mid-jump
    HIGH: groundCenter - apexUp * 0.9, // just under apex (full-jump reward)
  }
}

function circleHit(c, playerBounds) {
  // Closest point on the player AABB to the collectible center, then radius test.
  const nx = Math.max(playerBounds.x, Math.min(c.x, playerBounds.x + playerBounds.w))
  const ny = Math.max(playerBounds.y, Math.min(c.y, playerBounds.y + playerBounds.h))
  const dx = c.x - nx
  const dy = c.y - ny
  return dx * dx + dy * dy <= c.r * c.r
}

// True if a collectible at (x, y, r) sits within `margin` px of any obstacle.
// Obstacles and collectibles scroll at the same speed, so the gap measured at
// spawn holds for the whole approach — testing once at spawn is enough to
// guarantee the coin/item never overlaps (or hugs) the obstacle on screen.
function clearsObstacles(x, y, r, obstacles, margin) {
  for (const o of obstacles) {
    const b = o.bounds
    const nx = Math.max(b.x, Math.min(x, b.x + b.w))
    const ny = Math.max(b.y, Math.min(y, b.y + b.h))
    const dx = x - nx
    const dy = y - ny
    const reach = r + margin
    if (dx * dx + dy * dy < reach * reach) return false
  }
  return true
}

export class CollectibleDirector {
  constructor() {
    this.items = []
    this.coinTimer = 0
    this.itemTimer = 0
    this.profile = new Map() // tag.id → count collected this run
  }

  reset() {
    this.items = []
    this.coinTimer = COIN_INTERVAL
    this.itemTimer = ITEM_INTERVAL * 0.6 // first item comes a bit sooner
    this.profile.clear()
  }

  // The dream-kos tags collected this run, most-collected first. Drives §IX.
  dreamProfile() {
    return [...this.profile.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ ...FACILITY_TAGS.find((t) => t.id === id), count }))
  }

  // Returns the obstacle closest to the right edge that is still approaching
  // the player (x past the right-third of the screen). Coins place near this
  // one so the player must commit to the obstacle's verb to grab them.
  _upcomingObstacle(obstacles, game) {
    let best = null
    for (const o of obstacles) {
      if (o.x < game.width * 0.6) continue
      if (!best || o.x > best.x) best = o
    }
    return best
  }

  // `obstacles` is the live obstacle array from PlayScene; used to place coins
  // greedily near upcoming traffic (GDD §VII). Pass [] when unavailable.
  spawn(dt, game, obstacles = []) {
    this.coinTimer -= dt
    this.itemTimer -= dt

    if (this.coinTimer <= 0) {
      this.coinTimer = COIN_INTERVAL * (0.7 + Math.random() * 0.6)
      this._spawnCoinRun(game, obstacles)
    }
    if (this.itemTimer <= 0) {
      this.itemTimer = ITEM_INTERVAL * (0.8 + Math.random() * 0.5)
      this._spawnItem(game, obstacles)
    }
  }

  // A short arc of coins in one lane — placed near an upcoming obstacle when
  // one exists (GDD §VII greed), otherwise a random-lane arc at the right edge.
  _spawnCoinRun(game, obstacles = []) {
    const count = 2 + Math.floor(Math.random() * 3)
    const gap = Math.round(26 * game.scale)
    const margin = Math.round(CLEARANCE * game.scale)
    const coinR = Math.round(11 * game.scale) // matches COIN_R in Collectible

    const L = lanesFor(game)
    const ahead = this._upcomingObstacle(obstacles, game)
    let startX = game.width + 40 * game.scale
    // Greed placement: arc sits PAST the obstacle (so it scrolls clear of it)
    // in a lane the obstacle's verb forces you through. Push the start far
    // enough that no coin in the arc clips the obstacle's trailing edge.
    if (ahead) startX = ahead.x + ahead.w + margin + coinR

    // Pick a lane that keeps the whole arc clear of every obstacle. Try the
    // greed/random lane first, then the others; bail if all three are blocked
    // (rare — only when traffic is dense) rather than spawn an unreachable coin.
    const preferred = ahead ? greedLane(ahead.zone, L) : pickLane(L)
    const lanes = [preferred, L.FLOOR, L.MID, L.HIGH]
    const arcClear = (laneY) => {
      for (let i = 0; i < count; i++) {
        if (!clearsObstacles(startX + i * gap, laneY, coinR, obstacles, margin)) return false
      }
      return true
    }
    const lane = lanes.find(arcClear)
    if (lane === undefined) return // dense traffic — skip this arc

    for (let i = 0; i < count; i++) {
      const c = new Collectible('coin', game, lane)
      c.x = startX + i * gap
      this.items.push(c)
    }
  }

  // One dream-kos item, mid/high lane, kept clear of obstacles. Tries both
  // lanes before giving up so it never spawns buried in a door/pillar.
  _spawnItem(game, obstacles = []) {
    const tag = FACILITY_TAGS[Math.floor(Math.random() * FACILITY_TAGS.length)]
    const L = lanesFor(game)
    const margin = Math.round(CLEARANCE * game.scale)
    const itemR = Math.round(18 * game.scale) // matches ITEM_R in Collectible
    const x = game.width + itemR * 2 // matches Collectible constructor x
    const order = Math.random() < 0.5 ? [L.MID, L.HIGH] : [L.HIGH, L.MID]
    const lane = order.find((y) => clearsObstacles(x, y, itemR, obstacles, margin))
    if (lane === undefined) return // both lanes blocked — skip rather than overlap
    this.items.push(new Collectible('item', game, lane, tag))
  }

  // Scroll + resolve. Returns { coins, picked } for this frame:
  //   coins  — number of coins collected (combo fuel + currency)
  //   picked — array of dream-kos tags collected (for floats / events)
  update(dt, speed, playerBounds) {
    let coins = 0
    const picked = []
    for (let i = this.items.length - 1; i >= 0; i--) {
      const c = this.items[i]
      c.update(dt, speed)
      if (!c.collected && circleHit(c, playerBounds)) {
        c.collected = true
        if (c.kind === 'coin') {
          coins++
        } else if (c.tag) {
          this.profile.set(c.tag.id, (this.profile.get(c.tag.id) ?? 0) + 1)
          picked.push(c.tag)
        }
        this.items.splice(i, 1)
        continue
      }
      if (c.offscreen) this.items.splice(i, 1)
    }
    return { coins, picked }
  }

  draw(ctx) {
    this.items.forEach((c) => c.draw(ctx))
  }
}

function pickLane(L) {
  const r = Math.random()
  if (r < 0.5) return L.FLOOR
  if (r < 0.8) return L.MID
  return L.HIGH
}

// Greed lane (GDD §VII "ditaruh dekat obstacle"): pick a lane that forces the
// player to commit to the obstacle's verb to grab the coins.
//   floor obstacle (JUMP) → mid/high lane (must jump+air-grab)
//   ceiling obstacle (SLIDE) → floor lane (must slide+grab on the way under)
//   mid obstacle (DASH) → floor or high lane (must dash through, grab aside)
function greedLane(zone, L) {
  if (zone === 'floor') return Math.random() < 0.5 ? L.MID : L.HIGH
  if (zone === 'ceiling') return L.FLOOR
  return Math.random() < 0.5 ? L.FLOOR : L.HIGH
}
