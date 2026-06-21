import { useEffect, useRef } from 'react'
import { Game } from './Game'
import { GAME_W, GAME_H } from './constants'

const ASPECT = GAME_H / GAME_W

export default function GameCanvas() {
  const canvasRef = useRef(null)
  const gameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || gameRef.current) return
    gameRef.current = new Game(canvas)
    return () => {
      gameRef.current?.destroy()
      gameRef.current = null
    }
  }, [])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
    }}>
      <div style={{
        position: 'relative',
        width: `min(100vw, calc(100vh / ${ASPECT}))`,
        aspectRatio: `${GAME_W} / ${GAME_H}`,
        maxWidth: `${GAME_W}px`,
        maxHeight: '100vh',
        boxShadow: '0 0 0 2px #333, 0 8px 40px rgba(0,0,0,0.6)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          width={GAME_W}
          height={GAME_H}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
