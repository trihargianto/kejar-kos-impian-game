// ─── Horizon goal ─────────────────────────────────────────────────────────────
// The dream kos painted on the skyline (GDD §II "Horizon Goal"): a building
// silhouette that grows nearer/clearer as the player advances, plus a thin
// progress bar toward the 1000m gate. Makes "kejar" literal — the destination
// is always on screen, not just a distance number.
//
// Pure draw from a (dist) snapshot. Drawn behind obstacles/player, above the bg.
import { getKastaDef, getNextKastaThreshold } from '../../kasta.js'

const GATE = 1000 // meters to Mode Kos Impian

export class HorizonGoal {
  // `dist` meters; `game` provides width/height/scale/floorY.
  draw(ctx, game, dist) {
    const { width: W, scale: S, floorY } = game
    const kasta = getKastaDef(dist)

    // Proximity 0..1 toward the gate. Front-loaded (pow < 1) so the building
    // visibly grows in the first stretch — a flat linear ramp spread the change
    // across the whole 1000m and read as static in short runs.
    const linearProx = Math.min(1, dist / GATE)
    const prox = Math.pow(linearProx, 0.6) // size/clarity ramp (fast early, eases near gate)
    const baseY = floorY
    const bw = Math.round((70 + prox * 230) * S)
    const bh = Math.round((55 + prox * 300) * S)
    const bx = Math.round(W * 0.62 - bw / 2)
    const by = baseY - bh

    // Clarity: faint and hazy far away, solid and warm up close.
    ctx.save()
    ctx.globalAlpha = 0.35 + prox * 0.55

    // Building body — tint warms toward the dream as we near the gate.
    ctx.fillStyle = lerpColor('#9aa7c4', '#f6d6a8', prox)
    ctx.fillRect(bx, by, bw, bh)

    // Roof.
    ctx.fillStyle = lerpColor('#7d8aa8', '#e0a868', prox)
    ctx.beginPath()
    ctx.moveTo(bx - 4 * S, by)
    ctx.lineTo(bx + bw / 2, by - 22 * S)
    ctx.lineTo(bx + bw + 4 * S, by)
    ctx.closePath()
    ctx.fill()

    // Windows appear once we're close enough to "see" them (>40% there).
    if (prox > 0.4) {
      const winAlpha = (prox - 0.4) / 0.6
      ctx.globalAlpha *= winAlpha
      ctx.fillStyle = '#fff4cf'
      const cols = 3
      const rows = Math.max(2, Math.floor(bh / (28 * S)))
      const pad = 10 * S
      const ww = (bw - pad * (cols + 1)) / cols
      const wh = 14 * S
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(bx + pad + c * (ww + pad), by + pad + r * (wh + pad * 1.2), ww, wh)
        }
      }
      ctx.globalAlpha = 0.35 + prox * 0.55
    }
    ctx.restore()

    this._drawProgressBar(ctx, game, dist, kasta)
  }

  // Thin bar at the top: how close to the next milestone / the 1000m gate.
  _drawProgressBar(ctx, game, dist, kasta) {
    const { width: W, scale: S, safeTop } = game
    const next = getNextKastaThreshold(dist) ?? GATE
    const prevThreshold = kasta.fromMeters
    const span = Math.max(1, next - prevThreshold)
    const frac = Math.min(1, Math.max(0, (dist - prevThreshold) / span))

    const x = Math.round(W * 0.18)
    const w = Math.round(W * 0.64)
    const y = (safeTop || 0) + Math.round(56 * S)
    const h = Math.round(6 * S)

    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, h / 2)
    ctx.fill()

    ctx.fillStyle = '#e0a868'
    ctx.beginPath()
    ctx.roundRect(x, y, Math.round(w * frac), h, h / 2)
    ctx.fill()

    // Little house marker at the end of the bar — the goal you're filling toward.
    ctx.fillStyle = dist >= GATE ? '#f1c40f' : '#7d8aa8'
    ctx.font = `${Math.round(12 * S)}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('⌂', x + w + Math.round(10 * S), y + h)
  }
}

// Hex lerp (#rrggbb), t in 0..1.
function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
