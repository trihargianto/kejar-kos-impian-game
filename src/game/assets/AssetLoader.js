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

  // Load all images. `onUnit` is called once per image as it settles (loaded or
  // failed) so a loading screen can show progress; audio is loaded + counted
  // separately by AudioSystem (Howler), which the caller aggregates with this.
  async load(manifest = { images: {}, audio: {} }, onUnit = null) {
    const imgPromises = Object.entries(manifest.images || {}).map(
      ([id, src]) =>
        new Promise((resolve) => {
          const img = new Image()
          const done = () => {
            onUnit?.()
            resolve()
          }
          img.onload = () => {
            this._images.set(id, img)
            done()
          }
          img.onerror = () => {
            console.warn(`[AssetLoader] failed to load image: ${src}`)
            done()
          }
          img.src = src
        }),
    )

    // Audio playback is owned by AudioSystem (Howler), which loads clips by URL
    // from the manifest directly. We still record the id→src map here so has()/
    // audio() keep answering for non-playback callers and tests.
    for (const [id, src] of Object.entries(manifest.audio || {})) {
      this._audio.set(id, src)
    }

    await Promise.all(imgPromises)
  }

  // Number of image entries in a manifest — the loading screen uses this for the
  // image portion of the progress total.
  static imageCount(manifest = { images: {} }) {
    return Object.keys(manifest.images || {}).length
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
