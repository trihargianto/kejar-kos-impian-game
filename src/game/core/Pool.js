// ─── Object pool ──────────────────────────────────────────────────────────────
// Reusable instances to avoid GC churn from frequent spawn/despawn
// (obstacles, collectibles, particles, floating text). Allocate up to `cap`
// eagerly; grow lazily beyond that.
//
//   const pool = new Pool(() => new Obstacle(), (o) => o.reset(...), 64)
//   const o = pool.acquire()
//   pool.release(o)
//
// The factory must return a fresh object; the resetter reinitializes it.

export class Pool {
  constructor(factory, reset = () => {}, cap = 64, preallocate = cap) {
    this._factory = factory
    this._reset = reset
    this._free = []
    this._cap = cap
    this._activeCount = 0
    for (let i = 0; i < Math.min(preallocate, cap); i++) {
      this._free.push(factory())
    }
  }

  acquire(...resetArgs) {
    let obj = this._free.pop()
    if (!obj) {
      if (this._activeCount >= this._cap) return null
      obj = this._factory()
    }
    this._reset(obj, ...resetArgs)
    this._activeCount++
    return obj
  }

  release(obj) {
    if (!obj) return
    this._activeCount = Math.max(0, this._activeCount - 1)
    if (this._free.length < this._cap) this._free.push(obj)
  }

  get active() {
    return this._activeCount
  }

  get pooled() {
    return this._free.length
  }
}
