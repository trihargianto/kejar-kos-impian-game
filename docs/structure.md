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
│   ├── obstacles.test.js      # Obstacle zones / placement vs floorY
│   ├── powerups.test.js       # Kopi/Sandal power-ups, sandal target-claim
│   └── step2.test.js          # PromptDirector, budget+tier reveal + chip re-roll
└── src/
    ├── main.jsx               # React root render
    ├── App.jsx                # Renders <GameCanvas />
    ├── global.css             # App-shell + canvas frame styling
    └── game/                  # The game engine (framework-free JS)
```

## src/game — the engine

```
src/game/
├── Game.js                    # Owns canvas, main loop, pause, shared services, scenes
├── GameCanvas.jsx             # React: sizes canvas, safe-area, control buttons + pause
├── constants.js               # Tunable numbers (physics, speed, spawn, lives, FLOOR_HEIGHT...)
├── kasta.js                   # Kasta tiers (KASTA_METERS knob + KASTA_DEFS data)
├── theme.js                   # Colors, fonts, per-kasta bg, CTA pulse helper
│
├── core/                      # Reusable, game-agnostic machinery
│   ├── EventBus.js            # Tiny pub/sub + the EVENTS catalog
│   ├── State.js               # Generic finite state machine
│   ├── SceneManager.js        # Active-scene routing (enter/update/draw/exit)
│   ├── Input.js               # Key + virtual-button edges; named INTENT map
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
│   ├── Collectible.js         # Coins (Recehan) + power-ups (Kopi/Sandal)
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
│       ├── CollectibleSystem.js # Coin + power-up spawn, pickup (coins feed combo + budget)
│       ├── PromptDirector.js  # Milestone story prompts
│       ├── HorizonGoal.js     # Skyline dream-kos building + progress bar labeled both ends (current → next kasta)
│       ├── GroundPanel.js     # Ground strip: parallax detail, budget badge (MODAL KOS), KOPI chip
│       └── Hud.js             # Top HUD: lives, distance headline, score, combo badge + decay bar (pure draw)
│
└── systems/                   # Cross-scene logic
    ├── score.js               # Pure scoring/progression (rank, kasta, combo, score accumulator wired in PlayScene)
    ├── storage.js             # High-score persistence (score = jarak × combo, not distance)
    ├── audio.js               # WebAudio synth SFX (EventBus listener)
    └── dreamKos.js            # §IX reveal: budget (coins) + tier (dist) matcher + facility chips
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
| A collectible (coin/power-up) | `entities/Collectible.js` + `CollectibleSystem.js`        |
| A milestone prompt            | `PROMPTS` in `scenes/play/PromptDirector.js`               |
| Dream-kos listings            | `LISTINGS` in `systems/dreamKos.js`                        |
| A sound effect                | `systems/audio.js`                                         |
| HUD layout                    | `scenes/play/Hud.js`                                       |
| Ground-strip panels           | `scenes/play/GroundPanel.js`                               |
| Control buttons / pause / layout | `GameCanvas.jsx` (sizes via `BTN_SIZE`/`GRID_GAP`)      |
| An action's input mapping     | `INTENT` in `core/Input.js`                                |
| Ground / play-area height     | `FLOOR_HEIGHT` in `constants.js`                           |
| A new game state/screen       | add a scene in `scenes/`, register it in `Game.js`         |
| A new gameplay event          | add to `EVENTS` in `core/EventBus.js`, then emit/subscribe |

## File-size discipline

`PlayScene` is the only orchestrator and should stay one. If a sub-step grows
beyond a few lines of real logic, move it into a module under `scenes/play/`
(or `systems/`) and call it from the loop — don't let the scene accumulate
mechanics.
