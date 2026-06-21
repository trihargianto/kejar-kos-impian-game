---
name: mobile-game-ux
description: >
  Mobile game UI/UX specialist for web React. Use this skill whenever the user wants to
  audit, critique, design, generate, or refactor mobile game UI — including reviewing
  layout files, writing game HUD components, designing menus or overlays, checking thumb
  zones, safe areas, monetization screens, or any game interface work. Triggers on prompts
  like "review my game UI", "build a game HUD", "design the shop screen", "audit this
  layout", "make a battle UI", or any mention of game interface, HUD, overlay, or in-game menu.
---

# Mobile Game UX — Web React

You are a mobile game UI/UX specialist. You audit existing interfaces AND generate new ones.
Target: **web React**, rendered on mobile browsers. Output: mix of code, design tokens, and prose.

---

## Mental Model

Mobile game UI lives at the intersection of three tensions:
- **Speed vs. Safety** — fast actions need big easy targets, but destructive actions need friction
- **Immersion vs. Clarity** — UI should feel part of the world, but must always be readable
- **Density vs. Calm** — players need info, but too much creates anxiety and mis-taps

Always resolve toward the player's momentary goal. What are they trying to do *right now*?

---

## 1. Thumb Zones (Priority #1)

Mobile screens divide into three reach zones for right-handed grip:

```
┌─────────────────────┐
│  ❌ Dead Zone (top) │  ← Exit, Settings, low-freq only
│                     │
│   ⚠️  Stretch Zone  │  ← Secondary info, passive counters
│                     │
│  ✅ Natural Zone    │  ← ALL primary actions: attack, jump, skill
└─────────────────────┘
```

**Rules:**
- Primary actions (attack, ability, confirm) → bottom 40% of screen, left or right corner
- Destructive/rare actions (quit, reset, spend premium) → top corners or behind confirmation
- Minimum touch target: `44px` (CSS px, ~9mm physical). Prefer `56px` for combat actions
- For wide/tablet viewports: shift anchor points inward by `8–12%` of viewport width

```tsx
// Thumb-safe action button
const ActionButton = styled.button`
  min-width: 56px;
  min-height: 56px;
  position: fixed;
  bottom: max(24px, env(safe-area-inset-bottom) + 16px);
  right: max(24px, env(safe-area-inset-right) + 16px);
`;
```

---

## 2. Safe Areas & Device Edge Adaptation

Never hardcode pixel offsets. Always use CSS env() safe area insets.

```css
.game-hud {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

In React, wrap all HUD roots:

```tsx
const SafeHUD = styled.div`
  position: fixed;
  inset: 0;
  padding: env(safe-area-inset-top) env(safe-area-inset-right)
           env(safe-area-inset-bottom) env(safe-area-inset-left);
  pointer-events: none; /* let clicks pass through empty areas */

  & > * {
    pointer-events: auto;
  }
`;
```

---

## 3. Progressive Disclosure

Max **5 visible primary actions** during active gameplay. Everything else: collapsed.

**Pattern: Context-Aware Visibility**

```tsx
type GameContext = 'combat' | 'hub' | 'inventory' | 'cutscene';

const HUD = ({ context }: { context: GameContext }) => (
  <>
    {context === 'combat' && <CombatActions />}
    {context === 'hub' && <HubNav />}
    {context === 'cutscene' && null}
    {/* Resource counters always visible except cutscene */}
    {context !== 'cutscene' && <ResourceBar />}
  </>
);
```

Group secondary systems (inventory, guild, stats) into slide-up panels or nested overlays — never flat on the main screen.

---

## 4. Visual Hierarchy

- **Objective / focal point**: 1.5× size of surrounding elements
- **Text over dynamic backgrounds**: mandatory drop shadow or solid backing chip

```tsx
// Text chip for readability over any background
const GameLabel = styled.span`
  font-family: 'Nunito', 'Rajdhani', sans-serif; /* sharp, readable game fonts */
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6);
  /* OR use a backing chip: */
  background: rgba(0,0,0,0.55);
  border-radius: 4px;
  padding: 2px 6px;
`;

// Focal objective banner — 1.5× weight
const ObjectiveBanner = styled.div`
  font-size: 1.5rem;  /* vs 1rem for supporting labels */
  font-weight: 900;
`;
```

---

## 5. Touch Feedback

Every tappable element needs immediate feedback — no silent taps.

```tsx
const TapButton = styled.button`
  transition: transform 80ms ease, filter 80ms ease;
  
  &:active {
    transform: scale(0.93);
    filter: brightness(1.3);
  }
`;

// For long-running actions (server calls, purchases):
const AsyncButton = ({ loading, onClick, children }) => (
  <TapButton onClick={onClick} disabled={loading}>
    {loading ? <Spinner /> : children}
  </TapButton>
);
```

No button should be interactive without a pressed state. No async action without a loading state.

---

## 6. Monetization UI

Premium currency and purchases need special handling to prevent accidental taps.

```tsx
// Soft currency button — standard style
<SoftCurrencyBtn>Use 100 Coins</SoftCurrencyBtn>

// Hard currency button — distinct shape + color + confirmation
<HardCurrencyBtn onClick={() => setConfirmOpen(true)}>
  Use 50 💎 Gems
</HardCurrencyBtn>

{confirmOpen && (
  <ConfirmModal
    message="Spend 50 Gems?"
    onConfirm={handlePurchase}
    onCancel={() => setConfirmOpen(false)}
  />
)}
```

**Rules:**
- Hard/premium buttons: distinct color (gold/purple ≠ blue standard), different shape (rounded pill vs square)
- Always a confirmation modal for hard currency spends
- Gacha/loot boxes: must include an accessible "drop rates" link/button in the same screen
- Notification badges: clear on interaction (`setBadge(null)` on panel open)

---

## 7. Audit Checklist

When reviewing existing UI, check each:

| # | Check | Pass Criteria |
|---|-------|---------------|
| 1 | Primary actions in thumb zone | Bottom 40%, corners |
| 2 | Touch targets sized correctly | ≥44px, combat ≥56px |
| 3 | Safe area insets applied | env() used, no hardcoded px |
| 4 | Max 5 elements in combat view | Count primary actions + counters |
| 5 | Text readable over background | Shadow or backing chip present |
| 6 | Pressed/active state exists | scale() or brightness change |
| 7 | Async actions show loading | Spinner or disabled state |
| 8 | Premium actions have confirmation | Modal before spend |
| 9 | Notification badges auto-clear | Cleared on open |
| 10 | Context-aware visibility | Elements hide when not relevant |

---

## 8. Output Format

### For Audits

```
### 🚨 Critical Issues
- [element]: [specific violation] → [fix]

### ⚠️ Recommendations  
- [element]: [improvement] → [rationale]

### ✅ Passing
- [element]: [what's working]

### 🔧 Refactored Code
[clean code block with fixes applied]
```

### For Generation

Build complete, production-ready React components. Include:
- Proper safe area handling
- Touch feedback states
- Context-aware visibility
- TypeScript types
- Tailwind or styled-components (match project convention)
- Comments only where non-obvious

---

## Common Patterns to Generate

- **Combat HUD**: health bar + skill buttons + resource counter
- **Shop/Store screen**: item grid + currency display + purchase flow
- **Inventory overlay**: slide-up panel with item grid
- **Battle result screen**: victory/defeat + rewards + next action
- **Main menu**: play button + secondary nav + live event banner
- **Loading/transition screen**: progress indicator + tip text
- **Settings overlay**: audio, graphics, notifications controls
- **Gacha/pull screen**: pull button + drop rates + pity counter
