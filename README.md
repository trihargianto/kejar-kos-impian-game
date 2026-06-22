# Kejar Kos Impian

A 2D endless-runner comedy game, **mobile-first** (portrait), built for the
Mamikos Vibe Coding Contest. You play an anak kos who **sprints toward their
dream kos** while the old life (Ibu Kos + bills) tries to drag them back. Every
obstacle is a question: _play it safe, or graze it for combo?_

The signature hook is the **Kos Impian reveal** — coins you collect during a
run become your **budget**, the distance you reach sets the **tier** of kos you
qualify for, and the game-over screen shows a real-feeling listing you can
afford. Tap a facility chip (AC, WiFi, Dekat Kampus, K. Mandi Dalam) to
re-roll within your budget.

> Full game design lives in the GDD (Obsidian vault): _Kejar Kos Impian — Brief
> Concepts_. This README and `docs/` cover the **code**, not the design.

## Tech stack

| Layer         | Choice                                       |
| ------------- | -------------------------------------------- |
| App shell     | React 19 + Vite 8                            |
| Game engine   | Custom raw-canvas engine (no Kaboom/Phaser)  |
| Rendering     | HTML5 Canvas 2D, 9:16 portrait, scale-to-fit |
| Audio         | WebAudio synth (placeholder SFX)             |
| Tests         | Vitest                                       |
| Lint / format | ESLint + Prettier                            |
| Persistence   | `localStorage` (high score = skor: jarak × combo) |

> The game engine is hand-rolled under `src/game/`. React only mounts the canvas
> and forwards safe-area insets — all gameplay is plain JS, framework-agnostic
> and unit-testable without a DOM.

## Quick start

```bash
npm install
npm run dev        # Vite dev server
```

Open the printed URL on a phone (or a narrow desktop window — the game renders
as a centered 9:16 frame, it is not full-screen by design).

## Scripts

| Command                | Does                               |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Start the Vite dev server          |
| `npm run build`        | Production build to `dist/`        |
| `npm run preview`      | Serve the production build locally |
| `npm test`             | Run the Vitest suite once          |
| `npm run test:watch`   | Run tests in watch mode            |
| `npm run lint`         | ESLint over the project            |
| `npm run format`       | Prettier-write `src/`              |
| `npm run format:check` | Prettier check (CI-friendly)       |

## Controls

On-screen buttons (a 2×2 cluster bottom-right, below the floor line) are the
primary input; keyboard is a desktop fallback.

| Verb  | Mobile        | Desktop       |
| ----- | ------------- | ------------- |
| Jump  | JUMP button   | Space / ↑ / W |
| Slide | SLIDE button  | ↓ / S         |
| Dash  | DASH button   | Shift / →     |
| Throw | THROW button  | Q             |

Tap JUMP again in the air for a double jump. DASH shows a cooldown but stays
pressable; THROW is disabled without sandal ammo. A pause button sits top-right.

## Documentation

| Doc                                            | Contents                                                |
| ---------------------------------------------- | ------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)   | Engine design, game loop, scenes, systems, event flow   |
| [docs/structure.md](docs/structure.md)         | Directory layout and what every file owns               |
| [docs/code-standard.md](docs/code-standard.md) | Conventions, formatting, patterns, how to add a feature |

## At a glance

```
React (App → GameCanvas)
        │  mounts <canvas>, passes dpr + safe-area insets
        ▼
Game  ── owns canvas, main loop, shared context (input, events, audio, shake)
        │
SceneManager ── start → play → gameover
        │
PlayScene ── orchestrates per-frame systems:
             SpawnDirector · CollisionSystem · ComboSystem ·
             CollectibleSystem · PromptDirector · HorizonGoal · Hud
        │
EventBus ── decouples gameplay moments from listeners (audio, future analytics)
```

See [docs/architecture.md](docs/architecture.md) for the full picture.
