// ─── Event bus ────────────────────────────────────────────────────────────────
// Tiny pub/sub. Decouples gameplay moments (near-miss, damage, kasta-up,
// game-over, collect, ...) from listeners (audio, analytics, share-image,
// achievements). Scenes/entities emit; systems subscribe.
//
// Events are intentionally string constants — see EVENTS below for the catalog.
// Listeners run synchronously in subscription order. Errors in one listener
// are caught and logged so a buggy audio handler can't kill the game loop.

export const EVENTS = Object.freeze({
  // Lifecycle
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  SCENE_CHANGE: 'scene:change',
  PAUSE: 'game:pause',
  // Player
  PLAYER_JUMP: 'player:jump',
  PLAYER_SLIDE: 'player:slide',
  PLAYER_DASH: 'player:dash',
  PLAYER_HIT: 'player:hit',
  PLAYER_DEATH: 'player:death',
  // Scoring / feel
  NEAR_MISS: 'score:near-miss',
  COMBO_GAIN: 'combo:gain',
  COMBO_BREAK: 'combo:break',
  // Progression
  KASTA_UP: 'kasta:up',
  DISTANCE_MILESTONE: 'distance:milestone',
  IMPIAN_GATE: 'progress:impian-gate', // crossed 1000m → Mode Kos Impian
  PROMPT: 'progress:prompt', // milestone story prompt fired
  // Collectibles (Phase 1+)
  COLLECT_COIN: 'collect:coin',
  // Power-ups (GDD §VII)
  COLLECT_KOPI: 'collect:kopi',
  COLLECT_SANDAL: 'collect:sandal',
  SANDAL_THROW: 'sandal:throw',
  BOOST_START: 'boost:start',
  BOOST_END: 'boost:end',
  // UI
  HUD_TICK: 'hud:tick',
})

export class EventBus {
  constructor() {
    this._subs = new Map()
  }

  on(event, handler) {
    if (!this._subs.has(event)) this._subs.set(event, new Set())
    this._subs.get(event).add(handler)
    return () => this.off(event, handler)
  }

  once(event, handler) {
    const off = this.on(event, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  off(event, handler) {
    this._subs.get(event)?.delete(handler)
  }

  emit(event, payload) {
    const handlers = this._subs.get(event)
    if (!handlers) return
    for (const h of handlers) {
      try {
        h(payload)
      } catch (err) {
        console.error(`[EventBus] listener for "${event}" threw:`, err)
      }
    }
  }

  clear() {
    this._subs.clear()
  }
}
