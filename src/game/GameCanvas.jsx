import { useEffect, useRef, useState, useCallback } from 'react'
import { Game } from './Game.js'

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)
  const [ripples, setRipples] = useState([])
  const rippleId = useRef(0)

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

    gameRef.current = new Game(canvas, { safeTop, safeBottom, dpr })
    return () => {
      gameRef.current?.destroy()
      gameRef.current = null
    }
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
    </div>
  )
}
