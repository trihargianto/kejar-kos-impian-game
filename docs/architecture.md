# Architecture

How the game is wired, from the React mount down to the per-frame systems.

## Principles

1. **Engine is plain JS, React is just a mount.** Everything under `src/game/`
   (except the two `.jsx` files) is framework-free. The whole simulation can be
   constructed and stepped in a test with no DOM.
2. **One orchestrator, many small modules.** `PlayScene` drives the run loop but
   owns no mechanics — each mechanic lives in its own module under
   `scenes/play/`. Adding a feature extends or adds a module, it does not grow
   the scene.
3. **Data-driven where it varies.** Kasta tiers, obstacle defs, prompt
   thresholds, and dream-kos listings are data tables, not branchy code.
4. **Decoupled side effects.** Gameplay emits events; listeners (audio today,
   analytics/share later) subscribe. Gameplay never calls audio directly.
5. **Design pixels, not device pixels.** Game logic runs in a fixed 390×844
   coordinate space; the canvas context is pre-scaled to physical pixels once.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│ React                                                        │
│   App.jsx → GameCanvas.jsx                                   │
│   - sizes the <canvas> to physical pixels (dpr)             │
│   - reads safe-area insets, draws tap ripples               │
│   - constructs Game(canvas, { safeTop, safeBottom, dpr })   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ Game (src/game/Game.js)                                      │
│   - owns the canvas + 2D context (pre-scaled by dpr)        │
│   - owns the requestAnimationFrame main loop                │
│   - owns shared services: Input, EventBus, AudioSystem,     │
│     Shake, AssetLoader, floats[]                            │
│   - registers + drives scenes via SceneManager              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│ SceneManager → StartScene / PlayScene / GameOverScene        │
└───────────────────────────┬─────────────────────────────────┘
                            │ (play scene)
┌───────────────────────────▼─────────────────────────────────┐
│ Per-frame systems (src/game/scenes/play/)                    │
│   SpawnDirector · CollisionSystem · ComboSystem ·           │
│   CollectibleSystem · PromptDirector · HorizonGoal · Hud    │
│ Entities (src/game/entities/)                                │
│   Player (FSM) · Obstacle · Collectible · FloatText         │
│ Shared systems (src/game/systems/)                           │
│   score · storage · audio · dreamKos                        │
└─────────────────────────────────────────────────────────────┘
```

## The main loop

`Game._loop(ts)` runs once per animation frame:

```
dt = clamp(now - last, MAX_DT)   // cap huge gaps (tab switch) to avoid tunneling

update:
  shake.update(dt)
  scenes.update(dt)              // active scene steps its world
  floats.forEach(update)         // float text drifts + fades

draw (under the shake transform):
  ctx.translate(shakeOffset)
  scenes.draw(ctx)
  floats.forEach(draw)

input.flush()                    // clear per-frame "just pressed" edges
```

`dt` is in **seconds**. All velocities/timers are per-second so the sim is
frame-rate independent.

## Scenes

A scene is an object with optional `enter()`, `update(dt)`, `draw(ctx)`,
`exit()`. `SceneManager` routes to the active one; scenes transition by calling
`game.go(name)`.

| Scene | Role |
| --- | --- |
| `StartScene` | Title + opening; waits for first input → `play` |
| `PlayScene` | The run loop orchestrator (see below) |
| `GameOverScene` | Final distance, comedic rank, **Kos Impian reveal**, high score, retry |

### PlayScene loop order

`PlayScene.update(dt)` calls sub-steps in a deliberate order:

```
_updateSpeed       → kasta speedMultiplier × base ramp; feeds friction to player
_updateDistance    → integrate distance from speed
_handleInput       → route jump/slide/dash intents into the Player FSM
player.update      → physics + state machine step
_updateSpawning    → SpawnDirector emits obstacles (kasta-aware, vacuum twist)
_updateObstacles   → scroll + CollisionSystem test (near-miss / collision / dash-break)
_updateCollectibles→ scroll + pickup; coins feed combo, items build dream profile
combo.update       → near-miss multiplier decay
_updateKasta       → detect tier change; emit KASTA_UP / IMPIAN_GATE
_updatePrompts     → fire milestone story prompts
```

Death runs a `deathTimer` before transitioning to `gameover`, so the final hit
has time to land visually.

## Entities

- **Player** — movement via a `StateMachine` (`running` / `sliding` / `dashing`
  / `snapBack`). Each state owns its transitions and per-frame physics. Public
  API (`jump()`/`slide()`/`dash()`/`hit()`) sends intents and drains queued
  float-text requests. `friction` (set per-frame from the kasta) lengthens the
  dash on slippery floors.
- **Obstacle** — three zones (`floor` / `ceiling` / `mid`), each telegraphing
  one correct verb. `Obstacle.random()` draws from the pool; `Obstacle.special(id)`
  builds named kasta-twist obstacles (e.g. the vacuum).
- **Collectible** — `coin` (Recehan) or `item` (facility tag). Scrolls like an
  obstacle; resolution is a circle-vs-AABB test in `CollectibleSystem`.
- **FloatText** — short-lived rising/fading text for combos, hits, prompts.

## Systems (per-frame, under scenes/play/)

| System | Owns |
| --- | --- |
| `SpawnDirector` | Spawn cadence + obstacle stream; injects vacuum on vacuum-kasta |
| `CollisionSystem` | Pure geometry: near-miss / collision / dash-break decisions |
| `ComboSystem` | Near-miss count, per-kasta multiplier cap, decay timer |
| `CollectibleSystem` | Coin/item spawn, pickup, and the run's dream-kos profile |
| `PromptDirector` | Distance-keyed milestone prompts, fired once each in order |
| `HorizonGoal` | Skyline dream-kos building + progress bar (pure draw) |
| `Hud` | Lives, score, combo, coins, kasta, dash cooldown (pure draw) |

## Shared systems (cross-scene, under systems/)

| Module | Owns |
| --- | --- |
| `score` | Pure scoring/progression: rank, kasta label, combo multiplier, near-miss text |
| `storage` | High-score persistence via `localStorage`, guarded for private mode |
| `audio` | WebAudio synth SFX subscribing to the EventBus (placeholder until real SFX) |
| `dreamKos` | §IX reveal: matches a collected facility profile to a curated listing |

## Event flow

`EventBus` is a tiny synchronous pub/sub. Gameplay emits; listeners subscribe.
Listener errors are caught so one bad handler cannot kill the loop.

```
PlayScene / Player  ──emit──►  EventBus  ──►  AudioSystem (plays the right blip)
                                          ──►  (future) analytics, share-image
```

Catalog lives in `core/EventBus.js` (`EVENTS`). Key events: `GAME_START`,
`PLAYER_JUMP/SLIDE/DASH/HIT/DEATH`, `NEAR_MISS`, `KASTA_UP`, `IMPIAN_GATE`,
`PROMPT`, `COLLECT_COIN`, `COLLECT_ITEM`, `GAME_OVER`.

## Kasta progression (data-driven)

Tiers are records in `kasta.js` (`KASTA_DEFS`); the meter thresholds are hoisted
into `KASTA_METERS` at the top of that file — **the one knob** for tuning when a
tier starts. Each record carries its `speedMultiplier`, `frictionMultiplier`,
spawn rate, combo cap, and `mechanics` flags (`slippery`, `vacuum`, `endless`).
Consumers call `getKastaDef(dist)`; no switch chains.

| Tier | From | Twist |
| --- | --- | --- |
| Kipas Angin | 0m | Tutorial-safe |
| AC Standar | 300m | Lantai licin (low friction, longer dash) |
| Singgahsini | 700m | Vacuum chaser in the floor lane |
| Kos Impian | 1000m | Endless gate; combo cap released |

## Coordinate space & scaling

- Logic space is fixed at `GAME_WIDTH × GAME_HEIGHT` (390×844, 9:16).
- `Game` computes `scale = width / GAME_WIDTH` and pre-scales the 2D context by
  `dpr` once, so all draw calls use CSS pixels and stay crisp on HiDPI.
- Entities multiply design sizes by `game.scale` (`S`) when constructing.

## Testing strategy

Pure logic is unit-tested without a canvas (`test/`):

- `score.test.js` — ranks, kasta switch points, combo multiplier, near-miss text
- `collision.test.js` — `testObstacle` outcomes against stub player/obstacle
- `core.test.js` — `EventBus`, `StateMachine`, `Pool`
- `step2.test.js` — `PromptDirector`, dream-kos profile + matching

Draw code is deliberately thin and side-effect-free given a snapshot, so the
testable surface stays in pure modules.
