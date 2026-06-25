import { useEffect, useRef, useState, useCallback } from 'react'
import { Game } from './Game.js'
import { EVENTS } from './core/EventBus.js'
import { GAME_HEIGHT, FLOOR_HEIGHT } from './constants.js'
import { ShareButtons } from './ShareButtons.jsx'
import { SettingsPanel } from './SettingsPanel.jsx'
import { TutorialOverlay } from './TutorialOverlay.jsx'
import { seen, markSeen, TUTORIALS } from './systems/tutorial.js'

// Control cluster: a 2×2 grid of equal buttons. The box size is derived so the
// grid (two buttons + one gap each axis) fits exactly, with no leftover space.
const BTN_SIZE = 86
const GRID_GAP = 16
const CLUSTER_SIZE = BTN_SIZE * 2 + GRID_GAP // 188

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
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
  // Settings overlay: null = closed; { hasActiveRun } = open. Opened via the
  // OPEN_SETTINGS event (start screen) or the pause menu.
  const [settings, setSettings] = useState(null)
  // Tutorial overlay: null = closed; { key, firstTime } = active card.
  //   key       'intro' | 'kopi' | 'sandal'
  //   firstTime true on the auto first-launch/first-pickup showing (label the
  //             dismiss button "Saya mengerti, jangan tampilkan lagi"); false
  //             when replayed from the menu (label it "Tutup" — nothing to set).
  const [tutorial, setTutorial] = useState(null)
  // Height (CSS px) of the ground strip below the floor line. The button cluster
  // is confined to this band so it never overlaps the running area above it.
  const [groundH, setGroundH] = useState(0)
  // Boot splash overlay. Doubles as the audio-gesture gate: browsers won't play
  // sound before a user gesture, so the splash waits for a tap and starts music
  // on that tap — the player never hears a silent-then-pops audio start.
  //   ready   — all images + SFX cached (or the safety timeout fired); the
  //             "Tap untuk masuk" prompt replaces the progress bar.
  //   entered — the player tapped; the splash lifts and the game is revealed.
  const [loading, setLoading] = useState({ loaded: 0, total: 0, ready: false, entered: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gameRef.current) return

    // Size the canvas to its FRAME container (the centered 9:16 phone frame on
    // desktop, or the full viewport on mobile), not the raw window — so the game
    // renders inside the frame and not across the whole desktop viewport.
    const dpr = window.devicePixelRatio || 1
    const rect = (containerRef.current ?? canvas).getBoundingClientRect()
    const cssW = Math.round(rect.width)
    const cssH = Math.round(rect.height)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)

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

    // The game stretches GAME_HEIGHT onto the frame height, so the floor line
    // sits at FLOOR_HEIGHT/GAME_HEIGHT of the way up from the bottom. That band
    // (in CSS px) is the only place buttons may live so they stay off the run.
    setGroundH((FLOOR_HEIGHT / GAME_HEIGHT) * cssH)

    // First-pickup tutorial: pause the run + show the card the first time the
    // player collects this power-up. Already-seen → no-op (game keeps running).
    const maybeShowTutorial = (key) => {
      if (seen(key)) return
      game.setPaused(true)
      setTutorial({ key, firstTime: true })
    }

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
      // Start screen asks the shell to open Settings (it's a React overlay).
      game.events.on(EVENTS.OPEN_SETTINGS, ({ hasActiveRun = false } = {}) =>
        setSettings({ hasActiveRun })
      ),
      // Replay the intro tutorial from the start menu (no pause — no run behind).
      game.events.on(EVENTS.OPEN_TUTORIAL, () => setTutorial({ key: 'intro', firstTime: false })),
      game.events.on(EVENTS.GAME_START, () => setSandals(0)),
      game.events.on(EVENTS.COLLECT_SANDAL, ({ ammo }) => {
        setSandals(ammo)
        maybeShowTutorial('sandal')
      }),
      game.events.on(EVENTS.COLLECT_KOPI, () => maybeShowTutorial('kopi')),
      game.events.on(EVENTS.PAUSE, ({ paused }) => setPaused(paused)),
      // Leaving play (death, retry) clears any lingering pause state.
      game.events.on(EVENTS.SCENE_CHANGE, ({ scene }) => {
        if (scene !== 'play') game.setPaused(false)
      }),
    ]

    // Boot splash: mirror asset progress, then flip to the "Tap untuk masuk"
    // prompt once everything is cached. The loop already runs behind the splash,
    // so the start screen is fully painted (real art) the moment the player taps.
    game.onAssetProgress = (loaded, total) =>
      setLoading((l) => (l.ready ? l : { ...l, loaded, total }))
    game.assetsReady.then(() => setLoading((l) => ({ ...l, ready: true })))
    // Safety net: never trap the player on the splash if a fetch hangs (offline
    // asset, flaky CDN). Enable the tap prompt after 8s regardless — the game is
    // playable with placeholders and remaining assets keep streaming in.
    const loadGuard = setTimeout(() => setLoading((l) => ({ ...l, ready: true })), 8000)

    // Intro (first launch only): the Game constructor already entered the
    // 'start' scene before these listeners were attached, so check directly
    // rather than relying on the first SCENE_CHANGE. No pause needed — there's
    // no run behind the start screen.
    if (!seen('intro')) setTutorial({ key: 'intro', firstTime: true })

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

    // Keep the canvas matched to the frame container as it resizes (desktop
    // window resize, orientation change). Re-fit canvas pixels + the engine dims.
    const refit = () => {
      const r = (containerRef.current ?? canvas).getBoundingClientRect()
      const d = window.devicePixelRatio || 1
      const cw = Math.round(r.width)
      const ch = Math.round(r.height)
      if (cw === 0 || ch === 0) return
      canvas.width = Math.round(cw * d)
      canvas.height = Math.round(ch * d)
      game.resize(d)
      setGroundH((FLOOR_HEIGHT / GAME_HEIGHT) * ch)
    }
    const ro = new ResizeObserver(refit)
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(loadGuard)
      ro.disconnect()
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
    // These taps stopPropagation, so they never reach the container's handleTap
    // unlock — unlock here too so the first in-play action wakes the audio ctx.
    gameRef.current?.audio?.unlock()
    gameRef.current?.input.pressVirtual(code)
    if (code === 'Button:Throw') setSandals((n) => Math.max(0, n - 1))
  }, [])

  // Hold-to-slide: pointerdown holds the virtual code (fires the press edge too,
  // so the slide starts immediately), pointerup/leave/cancel releases it.
  const holdAction = useCallback((code, e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.audio?.unlock()
    gameRef.current?.input.holdVirtual(code)
  }, [])

  const releaseAction = useCallback((code, e) => {
    e.preventDefault()
    e.stopPropagation()
    gameRef.current?.input.releaseVirtual(code)
  }, [])

  const playMenuTap = useCallback(() => {
    gameRef.current?.audio?.unlock()
    gameRef.current?.audio?._playSample('sfx:menu_tap', 0.8)
  }, [])

  const togglePause = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    playMenuTap()
    gameRef.current?.togglePause()
  }, [playMenuTap])

  // Pause menu actions.
  const resumeGame = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    playMenuTap()
    gameRef.current?.setPaused(false)
  }, [playMenuTap])

  const openSettingsFromPause = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    playMenuTap()
    // Open Settings as an overlay ON TOP of the frozen run. The run stays paused
    // behind it; Save with no difficulty change (or Cancel) resumes it intact.
    setSettings({ hasActiveRun: true })
  }, [playMenuTap])

  const openTutorialFromPause = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    playMenuTap()
    // Replay the intro carousel ON TOP of the frozen run (z-index 35 > pause's
    // 10). firstTime:false → the dismiss button reads "Tutup" and sets no flag;
    // closing it returns to the still-paused pause menu underneath.
    setTutorial({ key: 'intro', firstTime: false })
  }, [playMenuTap])

  const exitToHome = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const game = gameRef.current
    if (!game) return
    // Quitting mid-run discards the current progress — confirm first.
    const ok = window.confirm('Keluar sekarang? Progres permainan ini akan hilang.')
    if (!ok) return
    playMenuTap()
    game.setPaused(false)
    game.go('start')
  }, [playMenuTap])

  // Apply the saved SFX on/off state to the live AudioSystem. Passed as a
  // callback so SettingsPanel never touches the game ref during render.
  const applyAudio = useCallback((sfx) => {
    gameRef.current?.audio?.setEnabled(sfx)
  }, [])

  // Close the Settings overlay. `restart` true → the player changed difficulty
  // during a paused run and confirmed: restart the run with the new difficulty.
  // Otherwise just close; if a run was paused behind, leave it paused (the pause
  // menu is still showing) so the player can Resume.
  const closeSettings = useCallback((restart) => {
    const game = gameRef.current
    setSettings(null)
    if (restart && game) {
      game.setPaused(false)
      game.go('play')
    }
  }, [])

  // Dismiss a tutorial card: mark it seen so it never shows again, close it,
  // and (for the mid-run item cards) resume the frozen run. The intro shows on
  // the start screen where nothing is paused, so resuming there is a no-op.
  const dismissTutorial = useCallback((key) => {
    markSeen(key)
    setTutorial(null)
    if (key === 'kopi' || key === 'sandal') gameRef.current?.setPaused(false)
  }, [])

  // Enter from the splash. This tap is the user gesture browsers require before
  // any audio, so unlock the context + kick the home music here — the game is
  // revealed already "sounded", with no silent-then-pops start.
  const enterGame = useCallback(() => {
    const audio = gameRef.current?.audio
    audio?.unlock()
    audio?.startHomeMusic()
    setLoading((l) => ({ ...l, entered: true }))
  }, [])

  const handleTap = useCallback((e) => {
    // First gesture unlocks the Web Audio context (suspended until then), so the
    // home music + SFX start playing instead of staying silent. Idempotent.
    gameRef.current?.audio?.unlock()
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
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
      onTouchStart={handleTap}
      onClick={handleTap}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Boot loading overlay — covers the canvas until every image + SFX is
          cached, so the start screen lifts straight to its real art with no
          sprite-pop. It also gates audio: the tap that dismisses it is the user
          gesture browsers need to start sound, so music begins on enter. Stays
          until the player taps (after load completes). */}
      {!loading.entered && (
        <div
          onPointerDown={loading.ready ? enterGame : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            background: '#1a1a2e',
            color: '#fff',
            userSelect: 'none',
            cursor: loading.ready ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 1,
              color: '#f1c40f',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            KEJAR KOS
            <br />
            IMPIAN
          </div>

          {loading.ready ? (
            // Load complete → the gesture gate: tap anywhere to enter + start audio.
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                padding: '12px 28px',
                borderRadius: 24,
                border: '2px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.08)',
                animation: 'tapPulse 1.4s ease-in-out infinite',
              }}
            >
              Tap untuk masuk
            </div>
          ) : (
            <>
              {/* Progress track + fill (flexbox, no grid). */}
              <div
                style={{
                  width: '60%',
                  maxWidth: 240,
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.14)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${loading.total ? Math.round((loading.loaded / loading.total) * 100) : 0}%`,
                    background: '#f1c40f',
                    borderRadius: 4,
                    transition: 'width 0.18s ease-out',
                  }}
                />
              </div>

              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#aaa' }}>
                Memuat{loading.total ? ` ${loading.loaded}/${loading.total}` : '…'}
              </div>
            </>
          )}
        </div>
      )}

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

      {/* Settings overlay — opened from the start menu or the pause menu. Sits
          above everything (incl. the pause overlay) via its own z-index. */}
      {settings && (
        <SettingsPanel
          hasActiveRun={settings.hasActiveRun}
          applyAudio={applyAudio}
          onClose={closeSettings}
          playMenuTap={playMenuTap}
        />
      )}

      {/* Tutorial overlay — intro (first launch) + first-pickup item cards.
          Sits above Settings/pause (z-index 35); item cards open over a frozen
          run and resume it on dismiss. */}
      {tutorial && (
        <TutorialOverlay
          data={TUTORIALS[tutorial.key]}
          firstTime={tutorial.firstTime}
          onDismiss={() => dismissTutorial(tutorial.key)}
          playMenuTap={playMenuTap}
        />
      )}

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

      {/* Paused overlay — dims the frozen frame and shows the pause menu:
          Main (resume) / Pengaturan / Keluar. */}
      {inPlay && paused && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10, // above the action cluster so it reads as a full stop
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontFamily: 'sans-serif',
            touchAction: 'none',
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 6 }}>
            JEDA
          </div>
          <MenuButton label="▶ Resume" primary onPress={resumeGame} />
          <MenuButton label="❓ Cara Main" onPress={openTutorialFromPause} />
          <MenuButton label="⚙ Pengaturan" onPress={openSettingsFromPause} />
          <MenuButton label="✕ Keluar" onPress={exitToHome} />
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

// Pause-menu button — full-width pill. Primary (resume) is accent-filled; the
// rest are outlined. onPress fires on pointerdown for snappy menu feel.
function MenuButton({ label, primary, onPress }) {
  return (
    <button
      type="button"
      onPointerDown={onPress}
      style={{
        width: 220,
        padding: '12px 0',
        borderRadius: 24,
        border: primary ? 'none' : '2px solid rgba(255,255,255,0.6)',
        background: primary ? '#e74c3c' : 'rgba(255,255,255,0.10)',
        color: '#fff',
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        fontSize: 17,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      {label}
    </button>
  )
}
