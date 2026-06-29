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

// Story canvas size. Fixed regardless of device — the share asset is always the
// same 9:16 IG-Story resolution.
export const SHARE_W = 1080
export const SHARE_H = 1920

// Where "berani ngalahin skor gue?" sends people. Swapped per deploy.
export const GAME_URL = 'https://kejar-kos-impian-game.vercel.app'

// Draw the full card onto a provided 2D context sized SHARE_W×SHARE_H.
// Exported on its own so it's unit-testable against a mock ctx without needing
// a real canvas / toBlob.
export function drawShareCard(ctx, { dist = 0, score = 0, logo } = {}) {
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

  // ── Logo (ui_logo.png, 1500×600 → rendered at 900×360, centered) ──
  const logoW = 900
  const logoH = 360
  const logoY = 220
  if (logo) {
    ctx.drawImage(logo, cx - logoW / 2, logoY, logoW, logoH)
  }

  // ── Jarak (the headline brag number) ──
  ctx.fillStyle = COLORS.gameoverDist
  ctx.font = `bold 240px ${FONTS.mono}`
  ctx.fillText(`${dist}m`, cx, 860)

  ctx.fillStyle = COLORS.faint
  ctx.font = `52px ${FONTS.mono}`
  ctx.fillText(`SKOR ${Math.floor(score)}`, cx, 960)

  // ── Pangkat komedi ──
  ctx.fillStyle = COLORS.white
  ctx.font = `bold 68px ${FONTS.sans}`
  ctx.fillText(getRank(dist), cx, 1080)

  // ── CTA + link ──
  ctx.fillStyle = COLORS.white
  ctx.font = `bold 60px ${FONTS.sans}`
  ctx.fillText('Berani ngalahin skor gue?', cx, 1680)

  ctx.fillStyle = COLORS.gold
  ctx.font = `bold 52px ${FONTS.mono}`
  ctx.fillText(GAME_URL.replace(/^https?:\/\//, ''), cx, 1780)
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
    const logo = new Image()
    logo.onload = () => {
      drawShareCard(ctx, { ...result, logo })
      const dataUrl = canvas.toDataURL('image/png')
      if (!canvas.toBlob) {
        resolve({ blob: dataUrlToBlob(dataUrl), dataUrl })
        return
      }
      canvas.toBlob((blob) => resolve({ blob, dataUrl }), 'image/png')
    }
    logo.onerror = () => {
      // Draw without logo if image fails to load.
      drawShareCard(ctx, result)
      const dataUrl = canvas.toDataURL('image/png')
      if (!canvas.toBlob) {
        resolve({ blob: dataUrlToBlob(dataUrl), dataUrl })
        return
      }
      canvas.toBlob((blob) => resolve({ blob, dataUrl }), 'image/png')
    }
    logo.src = '/sprites/ui_logo.png'
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
