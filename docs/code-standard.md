# Code standard

Conventions this codebase follows. The goal: new code should read like the code
already here.

## Formatting (enforced)

Prettier owns formatting — run `npm run format` before committing. Config
(`.prettierrc`):

| Rule | Value |
| --- | --- |
| Semicolons | **off** (`semi: false`) |
| Quotes | single (`singleQuote: true`) |
| Indent | 2 spaces, no tabs |
| Trailing commas | `es5` |
| Print width | 100 |
| Arrow parens | always (`(x) => ...`) |

Linting is ESLint flat config (`eslint.config.js`): JS recommended +
`react-hooks` + `react-refresh`, `dist/` ignored. Run `npm run lint`; keep it
clean (zero warnings).

## Language & modules

- **ES modules**, `import`/`export`. `"type": "module"`.
- Engine code is **plain JS** (no TypeScript, no JSX) so it stays DOM-free and
  unit-testable. Only `App.jsx` / `GameCanvas.jsx` use React.
- Prefer named exports for engine modules; React components default-export.
- Keep imports at the top, grouped roughly: constants/theme, core, then local.

## Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Classes | `PascalCase` | `SpawnDirector`, `ComboSystem` |
| Functions / vars | `camelCase` | `getKastaDef`, `nearMissDist` |
| Constants (tunables) | `UPPER_SNAKE` | `BASE_SPEED`, `KASTA_METERS` |
| Files (classes) | `PascalCase.js` | `Player.js`, `HorizonGoal.js` |
| Files (functions) | `camelCase.js` | `score.js`, `dreamKos.js`, `audio.js` |
| Private-ish fields | leading `_` | `this._lastKastaId`, `_drainFloats()` |

Indonesian is used for player-facing strings and domain terms (kasta names,
"Recehan", "Nyaris!"); code identifiers and comments are English.

## Comments

Every module opens with a **banner comment** explaining what it owns and why,
using the box style:

```js
// ─── Combo system ─────────────────────────────────────────────────────────────
// Near-miss tracking + multiplier + decay. Pure-ish: holds state but mutates
// only via the documented API (gain(), break(), update(dt)).
```

Inline comments explain **why**, not what. Reference the GDD section when a
choice traces to a design decision (e.g. `// GDD §VI twist`). Do not narrate
obvious code.

> Per the house style, **never use a double em dash**. A single em dash (or "—")
> is fine.

## Architectural patterns

- **One orchestrator, small modules.** `PlayScene` wires sub-steps together and
  owns no mechanic. A new mechanic is a new module under `scenes/play/` (or
  `systems/`), called from the loop. See [structure.md](structure.md).
- **Data over branches.** Per-tier/per-type variation goes in a data table
  (`KASTA_DEFS`, `OBS_DEFS`, `PROMPTS`, `LISTINGS`), read by a lookup, not a
  `switch`/`if` chain.
- **Pure where possible.** Geometry (`CollisionSystem`), scoring (`score.js`),
  and matching (`dreamKos.js`) are side-effect-free and unit-tested. Draw
  methods take a snapshot and own no state.
- **Events for side effects.** Gameplay emits on the `EventBus`; audio/analytics
  subscribe. Never call `audio` (or future analytics) from gameplay directly.
- **Time in seconds.** All velocities and timers are per-second; multiply by
  `dt`. Never bake in a frame count.
- **Design pixels.** Construct sizes in 390-wide design space, multiply by
  `game.scale` (`S`). Never hardcode device pixels.
- **Guard the environment.** `localStorage`, `AudioContext`, and `safe-area`
  reads are wrapped in try/catch and degrade silently (private mode, SSR,
  locked-down browsers).

## Layout / CSS (app shell)

- Use **flexbox** for layout. Avoid CSS grid.
- The game is mobile-first portrait; on desktop it renders as a centered 9:16
  frame (flex-centered), not full-screen.

## Adding a feature — worked example

To add a new per-frame mechanic (say, a power-up):

1. **Entity** (if it's a world object): add `entities/PowerUp.js` with
   `update(dt, speed)`, `bounds`, `offscreen`, `draw(ctx)`.
2. **Director**: add `scenes/play/PowerUpSystem.js` owning spawn + pickup,
   exposing `reset()`, `update(dt, ...)`, `draw(ctx)`.
3. **Wire** into `PlayScene`: construct in the ctor, `reset()` in `enter()`,
   call in `update()`/`draw()` in the right loop order.
4. **Event**: add to `EVENTS` in `core/EventBus.js`, emit on pickup; add an
   audio cue in `systems/audio.js`.
5. **Tune**: numbers go in `constants.js` (or the relevant kasta record).
6. **Test**: add a pure-logic test in `test/` for any non-draw decision.
7. `npm run lint && npm test && npm run build` — all clean before committing.

## Testing

- Tests live in `test/`, run with Vitest (`npm test`).
- Test **pure logic** — directors' decisions, scoring, matching, FSM, pools.
  Don't try to test canvas pixels; keep draw code thin instead.
- Stub the minimum: collision/score tests pass plain objects with only the
  fields the function reads.

## Commits

- Conventional-commit style subject (`feat:`, `fix:`, `refactor:`, `docs:`).
- Don't commit to the default branch directly — branch first.
- Run lint + tests + build before committing.
