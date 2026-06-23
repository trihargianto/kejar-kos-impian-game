import { useState, useCallback } from 'react'
import {
  loadSettings,
  saveSettings,
  DIFFICULTY_PRESETS,
  DIFFICULTY_ORDER,
} from './systems/settings.js'

// Settings overlay (GDD §Settings). Rendered by GameCanvas on top of the canvas
// (and, from pause, on top of the frozen run). Edits are a DRAFT — nothing is
// applied or persisted until "Simpan". Changing difficulty while a run is frozen
// (hasActiveRun) means the run must restart, so Simpan warns first.
//
// Props:
//   hasActiveRun     true when opened from the pause menu (a run is frozen behind)
//   applyAudio(sfx)  push the saved SFX on/off state to the live AudioSystem
//   onClose(restart) close the panel; restart=true → caller restarts the run
export function SettingsPanel({ hasActiveRun, applyAudio, onClose }) {
  const saved = loadSettings()
  const [sfx, setSfx] = useState(saved.sfx)
  const [difficulty, setDifficulty] = useState(saved.difficulty)

  const dirtyDifficulty = difficulty !== saved.difficulty

  const onSave = useCallback(() => {
    // Difficulty change mid-run restarts the run — confirm before discarding it.
    let restart = false
    if (dirtyDifficulty && hasActiveRun) {
      const ok = window.confirm(
        'Mengubah tingkat kesulitan akan mengulang permainan dari awal. Lanjutkan?'
      )
      if (!ok) return
      restart = true
    }
    saveSettings({ sfx, difficulty })
    applyAudio?.(sfx)
    onClose(restart)
  }, [dirtyDifficulty, hasActiveRun, sfx, difficulty, applyAudio, onClose])

  const onCancel = useCallback(() => onClose(false), [onClose])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        background: 'rgba(20,20,36,0.92)',
        color: '#fff',
        fontFamily: 'sans-serif',
        padding: 24,
        touchAction: 'none',
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 'bold', fontFamily: 'monospace' }}>PENGATURAN</div>

      {/* SFX toggle */}
      <Row label="Suara (SFX)">
        <button type="button" onPointerDown={() => setSfx((v) => !v)} style={pillStyle(sfx)}>
          {sfx ? 'ON' : 'OFF'}
        </button>
      </Row>

      {/* Difficulty segmented */}
      <Row label="Tingkat Kesulitan">
        <div style={{ display: 'flex', gap: 8 }}>
          {DIFFICULTY_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onPointerDown={() => setDifficulty(key)}
              style={segStyle(difficulty === key)}
            >
              {DIFFICULTY_PRESETS[key].label}
            </button>
          ))}
        </div>
      </Row>

      {dirtyDifficulty && hasActiveRun && (
        <div style={{ fontSize: 12, color: '#f1c40f', maxWidth: 280, textAlign: 'center' }}>
          ⚠ Mengubah kesulitan akan mengulang permainan dari awal.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        <button type="button" onPointerDown={onCancel} style={btnStyle(false)}>
          Kembali
        </button>
        <button type="button" onPointerDown={onSave} style={btnStyle(true)}>
          Simpan
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        minWidth: 240,
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75, fontFamily: 'monospace' }}>{label}</div>
      {children}
    </div>
  )
}

function pillStyle(on) {
  return {
    minWidth: 64,
    padding: '8px 16px',
    borderRadius: 18,
    border: 'none',
    background: on ? '#27ae60' : 'rgba(255,255,255,0.18)',
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    touchAction: 'none',
  }
}

function segStyle(sel) {
  return {
    padding: '10px 16px',
    borderRadius: 8,
    border: sel ? 'none' : '2px solid rgba(255,255,255,0.3)',
    background: sel ? '#e74c3c' : 'rgba(255,255,255,0.10)',
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    touchAction: 'none',
  }
}

function btnStyle(primary) {
  return {
    width: 130,
    padding: '12px 0',
    borderRadius: 24,
    border: primary ? 'none' : '2px solid rgba(255,255,255,0.6)',
    background: primary ? '#e74c3c' : 'rgba(255,255,255,0.10)',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    touchAction: 'none',
  }
}
