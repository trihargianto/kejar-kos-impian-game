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
