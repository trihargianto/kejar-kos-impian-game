import GameCanvas from './game/GameCanvas'

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
    }}>
      <GameCanvas />
    </div>
  )
}
