// ─── Horizon goal ─────────────────────────────────────────────────────────────
// The dream kos painted on the skyline (GDD §II "Horizon Goal"): a building
// silhouette that grows nearer/clearer as the player advances, plus a thin
// progress bar toward the 1000m gate. Makes "kejar" literal — the destination
// is always on screen, not just a distance number.
//
// Pure draw from a (dist) snapshot. Drawn behind obstacles/player, above the bg.
import { getKastaDef, getNextKastaThreshold, getNextKastaDef } from '../../kasta.js'
import { FONTS } from '../../theme.js'

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

  // Kasta-progress bar — a single neat row pinned just inside the top-safe area,
  // CENTERED so it clears the lives (top-left) and pause button (top-right). The
  // two kasta names sit INLINE, flanking the bar on the same baseline (current
  // on the left, next on the right), so nothing stacks under the bar or collides
  // with the hearts. This one row answers "where am I / what's next". At the
  // final tier the right side reads the endless goal.
  //
  // Layout (centered group): [current name]  ▁▁bar▁▁ ⌂  [next name]
  _drawProgressBar(ctx, game, dist, kasta) {
    const { width: W, scale: S, safeTop } = game
    const next = getNextKastaThreshold(dist) ?? GATE
    const nextDef = getNextKastaDef(dist)
    const prevThreshold = kasta.fromMeters
    const span = Math.max(1, next - prevThreshold)
    const frac = Math.min(1, Math.max(0, (dist - prevThreshold) / span))

    const leftLabel = titleCase(kasta.label)
    const rightLabel = nextDef ? titleCase(nextDef.label) : 'Kos Impian'

    // Bar + label geometry. Bar is a fixed slice in the middle; names flank it.
    const barW = Math.round(W * 0.30)
    const barH = Math.round(6 * S)
    const fontPx = Math.round(10 * S)
    const gap = Math.round(8 * S)
    const houseW = Math.round(13 * S)
    const cy = (safeTop || 0) + Math.round(12 * S) // vertical center of the row

    // Sits over the parallax wall — give the whole row a soft dark shadow so the
    // thin labels + bar stay legible against any background.
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = Math.round(3 * S)
    ctx.shadowOffsetY = Math.round(1 * S)

    ctx.font = `${fontPx}px ${FONTS.mono}`
    const leftW = ctx.measureText(leftLabel).width
    const rightW = ctx.measureText(rightLabel).width

    // Center the whole group so it's symmetric and never reaches the corners.
    const groupW = leftW + gap + barW + gap + houseW + gap + rightW
    let cx = Math.round((W - groupW) / 2)

    // Current kasta name (left).
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(leftLabel, cx, cy)
    cx += leftW + gap

    // The bar.
    const barY = cy - Math.round(barH / 2)
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.beginPath()
    ctx.roundRect(cx, barY, barW, barH, barH / 2)
    ctx.fill()
    ctx.fillStyle = '#e0a868'
    ctx.beginPath()
    ctx.roundRect(cx, barY, Math.max(barH, Math.round(barW * frac)), barH, barH / 2)
    ctx.fill()
    cx += barW + gap

    // House marker = the destination at the bar's end.
    ctx.fillStyle = dist >= GATE ? '#f1c40f' : '#b07d3a'
    ctx.font = `${Math.round(12 * S)}px ${FONTS.mono}`
    ctx.textAlign = 'center'
    ctx.fillText('⌂', cx + houseW / 2, cy)
    cx += houseW + gap

    // Next kasta name (right).
    ctx.font = `${fontPx}px ${FONTS.mono}`
    ctx.textAlign = 'left'
    ctx.fillStyle = nextDef ? 'rgba(255,255,255,0.7)' : '#f1d27a'
    ctx.fillText(rightLabel, cx, cy)

    ctx.restore()
    ctx.textBaseline = 'alphabetic' // restore default for other draws
  }
}

// "KIPAS ANGIN" → "Kipas Angin". Title Case reads softer than shouty all-caps
// mono for the kasta labels on the progress bar. Known acronyms (AC) stay upper.
const ACRONYMS = new Set(['AC'])
function titleCase(s) {
  return s
    .split(' ')
    .map((w) =>
      ACRONYMS.has(w.toUpperCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join(' ')
}

// Hex lerp (#rrggbb), t in 0..1.
function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}
