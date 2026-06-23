import GameCanvas from './game/GameCanvas'

// The game is mobile-first (portrait 9:16). On desktop / wide screens it is NOT
// full-screen — it renders inside a phone-sized 9:16 frame centered in the
// viewport (GDD §II), with a plain backdrop filling the rest. The frame uses
// flexbox centering (no grid) per the project's layout convention.
export default function App() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#12121f',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          // Lock to a 9:16 portrait frame, scaled to fit the viewport height,
          // never wider than the viewport. height drives it; width follows.
          position: 'relative',
          height: '100dvh',
          width: 'min(100dvw, calc(100dvh * 9 / 16))',
          aspectRatio: '9 / 16',
          maxHeight: '100dvh',
          overflow: 'hidden',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          background: '#1a1a2e',
        }}
      >
        <GameCanvas />
      </div>
    </div>
  )
}
