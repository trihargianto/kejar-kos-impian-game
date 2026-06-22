import { useEffect, useRef, useState, useCallback } from 'react'
import { Game } from './Game.js'
import { EVENTS } from './core/EventBus.js'
import { GAME_HEIGHT, FLOOR_HEIGHT } from './constants.js'
import { ShareButtons } from './ShareButtons.jsx'

// Control cluster: a 2×2 grid of equal buttons. The box size is derived so the
// grid (two buttons + one gap each axis) fits exactly, with no leftover space.
const BTN_SIZE = 86
const GRID_GAP = 16
const CLUSTER_SIZE = BTN_SIZE * 2 + GRID_GAP // 188

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [ripples, setRipples] = useState([])
  const rippleId = useRef(0)
  // Action buttons only matter during play; throw also needs ammo, dash a cooldown.
  const [inPlay, setInPlay] = useState(false)
  const [sandals, setSandals] = useState(0)
  // Dash cooldown remaining, rounded to 0.1s. 0 = ready. Shown over the button.
  const [dashCd, setDashCd] = useState(0)
  const [paused, setPaused] = useState(false)
  // Run summary for the share card, captured at game over. null = not on the
  // game-over screen, so the share buttons only mount there.
  const [gameOver, setGameOver] = useState(null)
  // Height (CSS px) of the ground strip below the floor line. The button cluster
  // is confined to this band so it never overlaps the running area above it.
  const [groundH, setGroundH] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gameRef.current) return

    // Set canvas resolution to physical pixels to avoid blur on HiDPI screens
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(window.innerWidth * dpr)
    const h = Math.round(window.innerHeight * dpr)
    canvas.width = w
    canvas.height = h

    // Read CSS env() safe area insets via a temporary element
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:env(safe-area-inset-top);left:env(safe-area-inset-left);' +
      'right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const safeTop = parseFloat(cs.top) || 0
    const safeBottom = parseFloat(cs.bottom) || 0
    document.body.removeChild(probe)

    const game = new Game(canvas, { safeTop, safeBottom, dpr })
    gameRef.current = game

    // The game stretches GAME_HEIGHT onto the viewport height, so the floor line
    // sits at FLOOR_HEIGHT/GAME_HEIGHT of the way up from the bottom. That band
    // (in CSS px) is the only place buttons may live so they stay off the run.
    setGroundH((FLOOR_HEIGHT / GAME_HEIGHT) * window.innerHeight)

    // Drive the on-screen buttons off the same event bus gameplay already uses.
    const offs = [
      game.events.on(EVENTS.SCENE_CHANGE, ({ scene }) => setInPlay(scene === 'play')),
      // Capture the run summary at game over (drives the share card); clear it
      // when leaving the game-over scene so the share buttons unmount.
      game.events.on(EVENTS.GAME_OVER, ({ dist, coins, score }) =>
        setGameOver({ dist, coins, score })
      ),
      game.events.on(EVENTS.SCENE_CHANGE, ({ scene }) => {
        if (scene !== 'gameover') setGameOver(null)
      }),
      game.events.on(EVENTS.GAME_START, () => setSandals(0)),
      game.events.on(EVENTS.COLLECT_SANDAL, ({ ammo }) => setSandals(ammo)),
      game.events.on(EVENTS.PAUSE, ({ paused }) => setPaused(paused)),
      // Leaving play (death, retry) clears any lingering pause state.
      game.events.on(EVENTS.SCENE_CHANGE, ({ scene }) => {
        if (scene !== 'play') game.setPaused(false)
      }),
    ]

    // Dash cooldown is frame-continuous (no discrete event), so poll the player's
    // dashCd for the countdown shown over the button. setState only when the
    // rounded 0.1s value changes, so React updates ~10×/cooldown, not every frame.
    let lastShown = -1
    let raf
    const pollDash = () => {
      const cd = game._scenes?.current?.player?.dashCd ?? 0
      const shown = cd > 0 ? Math.ceil(cd * 10) / 10 : 0
      if (shown !== lastShown) {
        lastShown = shown
        setDashCd(shown)
      }
      raf = requestAnimationFrame(pollDash)
    }
    raf = requestAnimationFrame(pollDash)

    return () => {
      cancelAnimationFrame(raf)
      offs.forEach((off) => off())
      game.destroy()
      gameRef.current = null
    }
  }, [])

  // Fire an action intent from a button on pointer-down (one event per physical
  // press — using pointerdown avoids the touchstart+synthesized-mousedown double
  // fire that was eating double jumps). stopPropagation keeps the tap off the
  // container ripple.
  const pressAction = useCallback((code, e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.input.pressVirtual(code)
    if (code === 'Button:Throw') setSandals((n) => Math.max(0, n - 1))
  }, [])

  // Hold-to-slide: pointerdown holds the virtual code (fires the press edge too,
  // so the slide starts immediately), pointerup/leave/cancel releases it.
  const holdAction = useCallback((code, e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.input.holdVirtual(code)
  }, [])

  const releaseAction = useCallback((code, e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.input.releaseVirtual(code)
  }, [])

  const togglePause = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.togglePause()
  }, [])

  const handleTap = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0] ?? e
    const id = ++rippleId.current
    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    setRipples((r) => [...r, { x, y, id }])
    setTimeout(() => setRipples((r) => r.filter((rpl) => rpl.id !== id)), 400)
  }, [])

  return (
    <div
      style={{ position: 'relative', width: '100dvw', height: '100dvh', overflow: 'hidden' }}
      onTouchStart={handleTap}
      onClick={handleTap}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            left: r.x - 20,
            top: r.y - 20,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            animation: 'ripple 0.4s ease-out forwards',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Share / download — game-over only. Pinned to the top safe area, clear of
          the reveal card + chips + retry prompt the canvas scene draws below.
          Buttons stopPropagation so a tap on them doesn't trigger the
          container's tap-to-retry. */}
      {gameOver && <ShareButtons result={gameOver} />}

      {/* Pause button — top-right, during play only. */}
      {inPlay && (
        <button
          type="button"
          aria-label={paused ? 'Resume' : 'Pause'}
          onPointerDown={togglePause}
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.55)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'none',
          }}
        >
          {paused ? '▶' : '❚❚'}
        </button>
      )}

      {/* Paused overlay — dims the frozen frame, tap anywhere (or the button) to resume. */}
      {inPlay && paused && (
        <div
          onPointerDown={togglePause}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10, // above the action cluster so it reads as a full stop
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontFamily: 'monospace',
            touchAction: 'none',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>JEDA</div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Ketuk untuk lanjut</div>
        </div>
      )}

      {inPlay && groundH > 0 && (
        // Control cluster (bottom-right): a neat 2×2 grid of equal-size buttons
        // with one uniform gap. JUMP is bottom-right (thumb home), SLIDE bottom-
        // left, DASH top-right, THROW top-left. The whole grid scales to fit the
        // ground strip (groundH) so it never pokes up into the running area.
        <div
          style={{
            position: 'absolute',
            right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
            width: CLUSTER_SIZE,
            height: CLUSTER_SIZE,
            transform: `scale(${Math.min(1, (groundH - 16) / CLUSTER_SIZE)})`,
            transformOrigin: 'bottom right',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: GRID_GAP,
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Grid order: row 1 = THROW, DASH · row 2 = SLIDE, JUMP. */}
          <ActionButton
            label="THROW"
            sub={sandals > 0 ? `×${sandals}` : null}
            disabled={sandals <= 0}
            size={BTN_SIZE}
            onPress={(e) => pressAction('Button:Throw', e)}
          />
          <ActionButton
            label="DASH"
            size={BTN_SIZE}
            cooldown={dashCd}
            onPress={(e) => pressAction('Button:Dash', e)}
          />
          <ActionButton
            label="SLIDE"
            size={BTN_SIZE}
            hold
            onPress={(e) => holdAction('Button:Slide', e)}
            onRelease={(e) => releaseAction('Button:Slide', e)}
          />
          <ActionButton
            label="JUMP"
            size={BTN_SIZE}
            onPress={(e) => pressAction('Button:Jump', e)}
          />
        </div>
      )}
    </div>
  )
}

// Action button — one cell in the control grid. Lives in the bottom-right
// cluster, BELOW the floor line, so it never covers an incoming obstacle.
//
// Two not-ready modes:
//   disabled  — HARD block (THROW with no ammo): unpressable + greyed.
//   cooldown  — SOFT (DASH while cooling): dimmed and shows the remaining time,
//               but STILL PRESSABLE. The press is harmlessly ignored by gameplay
//               (Player rejects a dash on cooldown), so the button is never a
//               dead zone — fixing the "can't press DASH" stuck state.
function ActionButton({ label, sub, disabled, cooldown = 0, size = 76, onPress, hold, onRelease }) {
  const cooling = cooldown > 0
  const dim = disabled || cooling
  // A held button must release on up AND on the pointer leaving/cancelling, or a
  // finger sliding off the button would leave it stuck "down" (permanent slide).
  const release = hold && !disabled ? onRelease : undefined
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={disabled ? undefined : onPress}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      style={{
        pointerEvents: 'auto',
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.6)',
        background: dim ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.28)',
        color: dim ? 'rgba(255,255,255,0.45)' : '#fff',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: Math.round(size * 0.17),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      <span>{label}</span>
      {cooling ? (
        <span style={{ fontSize: Math.round(size * 0.16), opacity: 0.95 }}>
          {cooldown.toFixed(1)}s
        </span>
      ) : (
        sub && <span style={{ fontSize: 12, opacity: 0.85 }}>{sub}</span>
      )}
    </button>
  )
}
