# Project structure

What every directory and file owns.

```
kejar-kos-impian-v2/
├── index.html                 # Vite entry; mounts #root, viewport-fit=cover
├── vite.config.js             # Vite + React plugin
├── eslint.config.js           # Flat ESLint config (js + react-hooks + react-refresh)
├── .prettierrc                # Formatting rules (see code-standard.md)
├── package.json               # Scripts + deps
├── README.md                  # Overview, quick start, scripts
├── docs/                      # This documentation
│   ├── architecture.md
│   ├── structure.md
│   └── code-standard.md
├── public/                    # Static assets served as-is
├── test/                      # Vitest suites (pure-logic only, no DOM)
│   ├── core.test.js           # EventBus, StateMachine, Pool
│   ├── score.test.js          # Ranks, kasta switch points, combo multiplier
│   ├── collision.test.js      # testObstacle outcomes
│   └── step2.test.js          # PromptDirector, dream-kos profile + matching
└── src/
    ├── main.jsx               # React root render
    ├── App.jsx                # Renders <GameCanvas />
    ├── global.css             # App-shell + canvas frame styling
    └── game/                  # The game engine (framework-free JS)
```

## src/game — the engine

```
src/game/
├── Game.js                    # Owns canvas, main loop, shared services, scenes
├── GameCanvas.jsx             # React: sizes canvas, safe-area insets, tap ripples
├── constants.js               # Tunable numbers (physics, speed, spawn, lives...)
├── kasta.js                   # Kasta tiers (KASTA_METERS knob + KASTA_DEFS data)
├── theme.js                   # Colors, fonts, per-kasta bg, CTA pulse helper
│
├── core/                      # Reusable, game-agnostic machinery
│   ├── EventBus.js            # Tiny pub/sub + the EVENTS catalog
│   ├── State.js               # Generic finite state machine
│   ├── SceneManager.js        # Active-scene routing (enter/update/draw/exit)
│   ├── Input.js               # Key + touch tracking; named INTENT map
│   ├── Shake.js               # Decaying screen-shake offset
│   ├── Pool.js                # Object pool (avoid GC churn)
│   └── utils.js               # lerp, clamp, easeOut, roundRect, aabb
│
├── assets/
│   └── AssetLoader.js         # Placeholder-aware image/audio loader (Step 4 swap-in)
│
├── entities/                  # Things that live in the world
│   ├── Player.js              # FSM-driven runner (run/slide/dash/snapBack)
│   ├── Obstacle.js            # Zoned obstacles + named kasta-twist specials
│   ├── Collectible.js         # Coins (Recehan) + dream-kos facility tags
│   └── FloatText.js           # Rising/fading text
│
├── scenes/                    # Top-level game states
│   ├── StartScene.js          # Title / opening
│   ├── PlayScene.js           # Run-loop orchestrator
│   ├── GameOverScene.js       # Result + Kos Impian reveal + retry
│   └── play/                  # Per-frame systems used only by PlayScene
│       ├── SpawnDirector.js   # Spawn cadence + obstacle stream (kasta-aware)
│       ├── CollisionSystem.js # Pure near-miss / collision / dash-break tests
│       ├── ComboSystem.js     # Near-miss multiplier + decay
│       ├── CollectibleSystem.js # Coin/item spawn, pickup, dream-kos profile
│       ├── PromptDirector.js  # Milestone story prompts
│       ├── HorizonGoal.js     # Skyline dream-kos building + progress bar
│       └── Hud.js             # In-play HUD (pure draw)
│
└── systems/                   # Cross-scene logic
    ├── score.js               # Pure scoring/progression functions
    ├── storage.js             # High-score persistence (localStorage)
    ├── audio.js               # WebAudio synth SFX (EventBus listener)
    └── dreamKos.js            # §IX listing matcher (curated fallback set)
```

## Where things go (cheat sheet)

| You want to change...         | Edit                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| A physics/tuning number       | `constants.js`                                             |
| When a kasta starts           | `KASTA_METERS` in `kasta.js`                               |
| A kasta's twist / speed / cap | that record in `KASTA_DEFS` (`kasta.js`)                   |
| Colors / fonts                | `theme.js`                                                 |
| A new obstacle type           | `OBS_DEFS` (or `SPECIAL_DEFS`) in `entities/Obstacle.js`   |
| Spawn logic                   | `scenes/play/SpawnDirector.js`                             |
| Combo rules                   | `scenes/play/ComboSystem.js` + `systems/score.js`          |
| A collectible / dream-kos tag | `entities/Collectible.js` + `CollectibleSystem.js`         |
| A milestone prompt            | `PROMPTS` in `scenes/play/PromptDirector.js`               |
| Dream-kos listings            | `LISTINGS` in `systems/dreamKos.js`                        |
| A sound effect                | `systems/audio.js`                                         |
| HUD layout                    | `scenes/play/Hud.js`                                       |
| A new game state/screen       | add a scene in `scenes/`, register it in `Game.js`         |
| A new gameplay event          | add to `EVENTS` in `core/EventBus.js`, then emit/subscribe |

## File-size discipline

`PlayScene` is the only orchestrator and should stay one. If a sub-step grows
beyond a few lines of real logic, move it into a module under `scenes/play/`
(or `systems/`) and call it from the loop — don't let the scene accumulate
mechanics.
