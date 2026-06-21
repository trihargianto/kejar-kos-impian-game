// ─── Scene manager ────────────────────────────────────────────────────────────
// Holds the active scene and routes update/draw to it. Scenes call ctx.go(name)
// (passed via the shared game context) to transition. Replaces the old
// string-based state machine with pluggable scene objects.
//
// A scene is an object with optional methods:
//   enter()       — called once when the scene becomes active
//   update(dt)    — called every frame
//   draw(ctx2d)   — called every frame after update
//   exit()        — called once when leaving the scene

export class SceneManager {
  constructor() {
    this.scenes = {}
    this.current = null
    this.currentName = null
  }

  register(name, scene) {
    this.scenes[name] = scene
    return this
  }

  go(name) {
    const next = this.scenes[name]
    if (!next) throw new Error(`Unknown scene: ${name}`)
    this.current?.exit?.()
    this.current = next
    this.currentName = name
    next.enter?.()
  }

  update(dt) {
    this.current?.update?.(dt)
  }

  draw(ctx2d) {
    this.current?.draw?.(ctx2d)
  }
}
