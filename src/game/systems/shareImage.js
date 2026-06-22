// ─── Share result image (GDD §XII) ─────────────────────────────────────────────
// Renders a 1080×1920 (Instagram Story 9:16) result card to an offscreen canvas
// and hands back a Blob + data URL. The game is already pure-canvas, so we draw
// the share card the same way instead of pulling in html2canvas to rasterize a
// DOM node — lighter, no extra dep, and pixel-identical across browsers.
//
// Content (per GDD §XII): title + character glyph, jarak + pangkat komedi, the
// run's dream kos (name + price), and a CTA + link back to the game/listing.
import { COLORS, FONTS } from '../theme.js'
import { getRank } from './score.js'
import { formatPrice } from './dreamKos.js'

// Story canvas size. Fixed regardless of device — the share asset is always the
// same 9:16 IG-Story resolution.
export const SHARE_W = 1080
export const SHARE_H = 1920

// Where "berani ngalahin skor gue?" sends people. Swapped per deploy.
export const GAME_URL = 'https://kejar-kos-impian.vercel.app'

// Draw the full card onto a provided 2D context sized SHARE_W×SHARE_H.
// Exported on its own so it's unit-testable against a mock ctx without needing
// a real canvas / toBlob.
export function drawShareCard(ctx, { dist = 0, score = 0, dreamKos } = {}) {
  const W = SHARE_W
  const H = SHARE_H
  const cx = W / 2

  // Background — deep night gradient matching the game-over scene.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1a1a2e')
  bg.addColorStop(1, '#0f0f1a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // ── Title ──
  ctx.fillStyle = COLORS.gameoverTitle
  ctx.font = `bold 96px ${FONTS.mono}`
  ctx.fillText('KEJAR', cx, 260)
  ctx.fillText('KOS IMPIAN', cx, 370)

  // ── Character glyph (placeholder runner — swapped for art in Step 4) ──
  // A simple red capsule + eye, echoing the in-game player block.
  ctx.fillStyle = COLORS.player
  ctx.beginPath()
  ctx.roundRect(cx - 90, 470, 180, 250, 40)
  ctx.fill()
  ctx.fillStyle = COLORS.playerEye
  ctx.beginPath()
  ctx.arc(cx + 30, 555, 28, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = COLORS.playerPupil
  ctx.beginPath()
  ctx.arc(cx + 42, 555, 13, 0, Math.PI * 2)
  ctx.fill()

  // ── Jarak (the headline brag number) ──
  ctx.fillStyle = COLORS.gameoverDist
  ctx.font = `bold 180px ${FONTS.mono}`
  ctx.fillText(`${dist}m`, cx, 920)

  ctx.fillStyle = COLORS.faint
  ctx.font = `40px ${FONTS.mono}`
  ctx.fillText(`SKOR ${Math.floor(score)}`, cx, 985)

  // ── Pangkat komedi ──
  ctx.fillStyle = COLORS.white
  ctx.font = `bold 54px ${FONTS.sans}`
  ctx.fillText(getRank(dist), cx, 1080)

  // ── Dream kos card ──
  if (dreamKos) {
    const cardX = 90
    const cardY = 1180
    const cardW = W - 180
    const cardH = 380
    ctx.fillStyle = 'rgba(241,196,15,0.12)'
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 32)
    ctx.fill()
    ctx.strokeStyle = COLORS.gold
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(cardX, cardY, cardW, cardH, 32)
    ctx.stroke()

    ctx.fillStyle = COLORS.faint
    ctx.font = `40px ${FONTS.mono}`
    ctx.fillText('🏠 KOS IMPIANKU', cx, cardY + 80)

    ctx.fillStyle = COLORS.white
    ctx.font = `bold 56px ${FONTS.sans}`
    ctx.fillText(truncate(ctx, dreamKos.name, cardW - 80), cx, cardY + 170)

    ctx.fillStyle = COLORS.gold
    ctx.font = `bold 52px ${FONTS.mono}`
    ctx.fillText(formatPrice(dreamKos.price), cx, cardY + 250)

    if (dreamKos.area) {
      ctx.fillStyle = COLORS.faint
      ctx.font = `38px ${FONTS.mono}`
      ctx.fillText(`${dreamKos.area} · ada di Mamikos`, cx, cardY + 320)
    }
  }

  // ── CTA + link ──
  ctx.fillStyle = COLORS.white
  ctx.font = `bold 52px ${FONTS.sans}`
  ctx.fillText('Berani ngalahin skor gue?', cx, 1720)

  ctx.fillStyle = COLORS.gold
  ctx.font = `bold 44px ${FONTS.mono}`
  ctx.fillText(GAME_URL.replace(/^https?:\/\//, ''), cx, 1800)
}

// Shrink text with an ellipsis until it fits maxW at the current font.
function truncate(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1)
  }
  return t + '…'
}

// Render to an offscreen canvas and resolve { blob, dataUrl }. The caller wires
// these into the Web Share API (blob → File) and the download fallback (dataUrl).
// Rejects if canvas/toBlob is unavailable (very old browser).
export function generateShareImage(result) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = SHARE_W
    canvas.height = SHARE_H
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('2D canvas unavailable'))
      return
    }
    drawShareCard(ctx, result)
    const dataUrl = canvas.toDataURL('image/png')
    if (!canvas.toBlob) {
      // Fallback: derive a blob from the data URL.
      resolve({ blob: dataUrlToBlob(dataUrl), dataUrl })
      return
    }
    canvas.toBlob((blob) => {
      resolve({ blob, dataUrl })
    }, 'image/png')
  })
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
