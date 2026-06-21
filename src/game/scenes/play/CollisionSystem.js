// ─── Collision + near-miss detection ──────────────────────────────────────────
// Stateless functions that test one obstacle against the player each frame.
// The scene owns the loop and the side effects (damage, combo, floats); this
// module owns the geometry and decision logic.
//
// Returns one of four outcomes per obstacle:
//   'near-miss'  — obstacle just passed within near-miss window this frame
//   'collision'  — obstacle overlaps player hitbox and the hit lands
//   'dash-break' — player is dashing through a mid-zone obstacle (the door
//                  "breaks" — scene removes it and rewards combo)
//   null         — nothing happened
//
// Each obstacle carries `passed` / `nearMissed` flags so we don't re-fire the
// same event for the same obstacle across frames. This module mutates those
// flags as it transitions between zones.
import { NEAR_MISS_DISTANCE } from '../../constants.js'
import { aabb } from '../../core/utils.js'

/**
 * @param {object} obstacle   { x, y, w, h, bounds, zone, passed, nearMissed }
 * @param {object} player     { x, y, w, h, bounds, invincible, snappingBack, dashing }
 * @param {number} nearMissDist  px gap (already scaled) that counts as "mepet"
 */
export function testObstacle(obstacle, player, nearMissDist) {
  // Already resolved in a previous frame?
  if (obstacle.passed || obstacle.nearMissed) {
    return maybeCollision(obstacle, player)
  }

  const playerRight = player.x + player.w
  const gap = obstacle.x - playerRight

  if (gap >= 0 && gap < nearMissDist) {
    obstacle.nearMissed = true
    return 'near-miss'
  }

  if (gap < 0 && obstacle.x + obstacle.w < player.x - nearMissDist * 2) {
    obstacle.passed = true
  }

  return maybeCollision(obstacle, player)
}

function maybeCollision(obstacle, player) {
  if (player.snappingBack) return null
  if (!aabb(player.bounds, obstacle.bounds)) return null
  // Contact confirmed — decide what kind.
  if (player.invincible) return null
  // Dashing through a mid-zone obstacle (the door) BREAKS it instead of
  // damaging the player. The scene removes the obstacle on 'dash-break'.
  // Without this, the door catches up from behind after snap-back ends and
  // the player always takes a hit on otherwise-perfect dashes.
  if (player.dashing && obstacle.zone === 'mid') return 'dash-break'
  return 'collision'
}

// Convenience: scaled near-miss distance for the current game scale.
export function scaledNearMissDist(game) {
  return NEAR_MISS_DISTANCE * game.scale
}
