# Kejar Kos Impian

A 2D endless-runner comedy game, **mobile-first** (portrait), built for the
Mamikos Vibe Coding Contest. You play an anak kos who **sprints toward their
dream kos** while the old life (Ibu Kos + bills) tries to drag them back. Every
obstacle is a question: *play it safe, or graze it for combo?*

The signature hook is the **Kos Impian reveal** — facility tags you collect
during a run match you to a real-feeling kos listing on the game-over screen.

> Full game design lives in the GDD (Obsidian vault): *Kejar Kos Impian — Brief
> Concepts*. This README and `docs/` cover the **code**, not the design.

## Tech stack

| Layer | Choice |
| --- | --- |
| App shell | React 19 + Vite 8 |
| Game engine | Custom raw-canvas engine (no Kaboom/Phaser) |
| Rendering | HTML5 Canvas 2D, 9:16 portrait, scale-to-fit |
| Audio | WebAudio synth (placeholder SFX) |
| Tests | Vitest |
| Lint / format | ESLint + Prettier |
| Persistence | `localStorage` (high score) |

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

| Command | Does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint over the project |
| `npm run format` | Prettier-write `src/` |
| `npm run format:check` | Prettier check (CI-friendly) |

## Controls

| Verb | Mobile | Desktop |
| --- | --- | --- |
| Jump | Tap | Space / ↑ / W |
| Slide | Swipe ↓ | ↓ / S |
| Dash | Swipe → | Shift / → |

Touch is the primary input; keyboard is a desktop fallback.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Engine design, game loop, scenes, systems, event flow |
| [docs/structure.md](docs/structure.md) | Directory layout and what every file owns |
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
