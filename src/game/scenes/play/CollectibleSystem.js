// ─── Collectible director ─────────────────────────────────────────────────────
// Spawns Recehan (coins) + Item Kos Impian (facility tags), scrolls them, and
// resolves pickups against the player. Owns the dream-kos profile (which tags
// the player grabbed this run) so the §IX reveal can read it at game over.
//
// Greed placement (GDD §VII): coins sit in the floor/ceiling lanes near where
// obstacles travel, so the most profitable line is also the riskiest. Items are
// rarer and float mid-air to pull the player off a safe path.
import { GAME_HEIGHT, PLAYER_HEIGHT } from '../../constants.js'
import { Collectible, FACILITY_TAGS } from '../../entities/Collectible.js'

const COIN_INTERVAL = 0.9 // base seconds between coin spawns
const ITEM_INTERVAL = 6.0 // base seconds between dream-kos item spawns

// Design-space lanes (390×844 baseline). Floor surface ≈ GAME_HEIGHT-120.
const FLOOR_LANE = GAME_HEIGHT - 120 - 30
const MID_LANE = GAME_HEIGHT - 120 - PLAYER_HEIGHT - 70
const HIGH_LANE = GAME_HEIGHT - 120 - PLAYER_HEIGHT - 150

function circleHit(c, playerBounds) {
  // Closest point on the player AABB to the collectible center, then radius test.
  const nx = Math.max(playerBounds.x, Math.min(c.x, playerBounds.x + playerBounds.w))
  const ny = Math.max(playerBounds.y, Math.min(c.y, playerBounds.y + playerBounds.h))
  const dx = c.x - nx
  const dy = c.y - ny
  return dx * dx + dy * dy <= c.r * c.r
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

  spawn(dt, game) {
    this.coinTimer -= dt
    this.itemTimer -= dt

    if (this.coinTimer <= 0) {
      this.coinTimer = COIN_INTERVAL * (0.7 + Math.random() * 0.6)
      this._spawnCoinRun(game)
    }
    if (this.itemTimer <= 0) {
      this.itemTimer = ITEM_INTERVAL * (0.8 + Math.random() * 0.5)
      const tag = FACILITY_TAGS[Math.floor(Math.random() * FACILITY_TAGS.length)]
      const lane = Math.random() < 0.5 ? MID_LANE : HIGH_LANE
      this.items.push(new Collectible('item', game, lane, tag))
    }
  }

  // A short arc of coins in one lane — easy to read, satisfying to sweep up.
  _spawnCoinRun(game) {
    const lane = pickLane()
    const count = 2 + Math.floor(Math.random() * 3)
    const gap = Math.round(26 * game.scale)
    for (let i = 0; i < count; i++) {
      const c = new Collectible('coin', game, lane)
      c.x += i * gap
      this.items.push(c)
    }
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

function pickLane() {
  const r = Math.random()
  if (r < 0.5) return FLOOR_LANE
  if (r < 0.8) return MID_LANE
  return HIGH_LANE
}
