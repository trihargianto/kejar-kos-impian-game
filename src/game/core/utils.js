// ─── Math + draw helpers ──────────────────────────────────────────────────────
export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}

export function roundRect(ctx, x, y, w, h, r = 0) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

// Axis-aligned bounding-box overlap. Boxes are {x, y, w, h}.
export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// Apply a soft dark text shadow on `ctx` so light/colored HUD text stays legible
// over the busy parallax wall. Call before a block of fillText, then clearShadow
// after. `S` = game.scale so the blur tracks resolution. Pair with ctx.save/
// restore at the call site, or use clearShadow() to reset.
export function setTextShadow(ctx, S = 1, alpha = 0.6) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`
  ctx.shadowBlur = Math.round(4 * S)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(1 * S)
}

export function clearShadow(ctx) {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
}
