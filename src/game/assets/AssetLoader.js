// ─── Asset loader (placeholder-aware) ─────────────────────────────────────────
// Future-proof entry point for sprites + audio. Today every entity draws with
// canvas primitives; in Step 4 of the dev plan, real PNGs + SFX get dropped in
// here and entities look up assets by id instead of branching in their draw().
//
// The contract:
//   - `load(manifest)` returns a Promise that resolves when everything is cached.
//   - `image(id)` / `audio(id)` return the cached asset or null.
//   - `has(id)` lets callers fall back to placeholder rendering if missing.
//
// Today this is a no-op stub: load() resolves immediately, lookups return null.
// Entities should code defensively (if (assets.has(id)) drawSprite(...) else drawPlaceholder(...))
// so swapping in real assets later touches only this file + the manifest.

// Manifest shape (for future reference):
//   {
//     images: { 'player:run': 'sprites/player_run.png', ... },
//     audio:  { 'sfx:jump': 'audio/jump.mp3', ... },
//   }

export class AssetLoader {
  constructor() {
    this._images = new Map()
    this._audio = new Map()
  }

  async load(manifest = { images: {}, audio: {} }) {
    const imgPromises = Object.entries(manifest.images || {}).map(
      ([id, src]) =>
        new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            this._images.set(id, img)
            resolve()
          }
          img.onerror = () => {
            console.warn(`[AssetLoader] failed to load image: ${src}`)
            resolve()
          }
          img.src = src
        }),
    )

    const audioPromises = Object.entries(manifest.audio || {}).map(([id, src]) => {
      const a = new Audio(src)
      a.preload = 'auto'
      this._audio.set(id, a)
      return Promise.resolve()
    })

    await Promise.all([...imgPromises, ...audioPromises])
  }

  image(id) {
    return this._images.get(id) ?? null
  }

  audio(id) {
    return this._audio.get(id) ?? null
  }

  has(id) {
    return this._images.has(id) || this._audio.has(id)
  }

  get loaded() {
    return this._images.size + this._audio.size
  }
}
