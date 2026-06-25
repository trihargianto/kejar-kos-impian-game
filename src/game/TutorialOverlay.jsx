// ─── Tutorial overlay ─────────────────────────────────────────────────────────
// One-time explainer screens rendered by GameCanvas on top of the canvas.
//   intro  → swipeable carousel (multi-slide), dismiss on the last slide
//   kopi /
//   sandal → single card (first-pickup), opens over a frozen run
// Each screen has a media slot above a short explanation. Until a video path is
// supplied (TUTORIALS[key].media), the slot shows a "Video menyusul" placeholder;
// filling media in later swaps a <video> in with no structural change.
//
// Content (TUTORIALS) lives in systems/tutorial.js so this file exports only a
// component (Fast Refresh requires it). All sub-components below are local.
import { useState, useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 40 // px horizontal travel to flip a slide

// `firstTime` true → the auto first-launch/first-pickup showing; the final
// button reads "Saya mengerti, jangan tampilkan lagi" (it sets the seen flag).
// false → replayed from the menu; the flag is already set, so the button just
// reads "Tutup".
export function TutorialOverlay({ data, firstTime = true, onDismiss, playMenuTap }) {
  const dismissLabel = firstTime ? 'Saya mengerti, jangan tampilkan lagi' : 'Tutup'
  const onDismissWithSfx = useCallback(() => { playMenuTap?.(); onDismiss() }, [onDismiss, playMenuTap])
  return (
    <div style={scrimStyle}>
      {data.type === 'carousel' ? (
        <TutorialCarousel slides={data.slides} dismissLabel={dismissLabel} onDismiss={onDismissWithSfx} playMenuTap={playMenuTap} />
      ) : (
        <TutorialCard {...data} dismissLabel={dismissLabel} onDismiss={onDismissWithSfx} />
      )}
    </div>
  )
}

// Media slot — fixed aspect ratio so layout is stable whether a video is present
// or not. Real video autoplays muted+looped+inline (the only combo browsers
// allow to autoplay on mobile); the placeholder fills the same box.
function TutorialMedia({ media }) {
  return (
    <div style={mediaBoxStyle}>
      {media ? (
        <video
          src={media}
          muted
          loop
          playsInline
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={mediaPlaceholderStyle}>
          <div style={{ fontSize: 30, opacity: 0.7 }}>▶</div>
          <div style={{ fontSize: 12, opacity: 0.6, fontFamily: 'monospace' }}>Video menyusul</div>
        </div>
      )}
    </div>
  )
}

// One screen's content: media slot + title + body lines + a footer button.
// The footer button is the dismiss CTA on the last/only screen, or "Lanjut →"
// mid-carousel (passed via `footer`).
function TutorialCard({ media, title, body, footer, dismissLabel, onDismiss }) {
  return (
    <div style={cardStyle}>
      <TutorialMedia media={media} />
      <div style={{ fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center' }}>
        {title}
      </div>
      <div style={bodyStyle}>
        {body.map((line, i) => (
          <div key={i} style={{ opacity: 0.92 }}>
            {line}
          </div>
        ))}
      </div>
      {footer ?? (
        <button type="button" onPointerDown={onDismiss} style={dismissStyle}>
          {dismissLabel}
        </button>
      )}
    </div>
  )
}

// Swipeable multi-slide intro. Horizontal pointer drag flips slides; dots show
// position. The dismiss CTA only appears on the last slide (earlier slides show
// "Lanjut →"), so the player is walked through the whole intro before exiting.
function TutorialCarousel({ slides, dismissLabel, onDismiss, playMenuTap }) {
  const [i, setI] = useState(0)
  const startX = useRef(null)
  const last = slides.length - 1

  const go = useCallback(
    (next) => { playMenuTap?.(); setI((cur) => Math.max(0, Math.min(last, next ?? cur))) },
    [last, playMenuTap]
  )

  const onPointerDown = useCallback((e) => {
    startX.current = e.clientX
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (startX.current == null) return
      const dx = e.clientX - startX.current
      startX.current = null
      if (dx < -SWIPE_THRESHOLD) setI((c) => Math.min(last, c + 1))
      else if (dx > SWIPE_THRESHOLD) setI((c) => Math.max(0, c - 1))
    },
    [last]
  )

  const slide = slides[i]
  const footer =
    i < last ? (
      <button type="button" onPointerDown={() => go(i + 1)} style={dismissStyle}>
        Lanjut →
      </button>
    ) : (
      <button type="button" onPointerDown={onDismiss} style={dismissStyle}>
        {dismissLabel}
      </button>
    )

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <TutorialCard {...slide} footer={footer} onDismiss={onDismiss} />
      <div style={{ display: 'flex', gap: 8 }}>
        {slides.map((_, d) => (
          <button
            key={d}
            type="button"
            aria-label={`Slide ${d + 1}`}
            onPointerDown={() => go(d)}
            style={dotStyle(d === i)}
          />
        ))}
      </div>
      {i < last && (
        <button type="button" onPointerDown={() => { playMenuTap?.(); onDismiss() }} style={skipStyle}>
          Lewati
        </button>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const scrimStyle = {
  position: 'absolute',
  inset: 0,
  zIndex: 35, // above Settings (30) and the pause overlay (10)
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  background: 'rgba(20,20,36,0.94)',
  color: '#fff',
  fontFamily: 'sans-serif',
  padding: 24,
  touchAction: 'none',
}

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  maxWidth: 320,
  width: '100%',
}

const mediaBoxStyle = {
  width: '100%',
  maxWidth: 320,
  aspectRatio: '16 / 9',
  borderRadius: 14,
  overflow: 'hidden',
  background: 'rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.12)',
}

const mediaPlaceholderStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
}

const bodyStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 320,
  fontSize: 15,
  lineHeight: 1.45,
  textAlign: 'center',
}

const dismissStyle = {
  marginTop: 4,
  maxWidth: 320,
  padding: '14px 20px',
  borderRadius: 24,
  border: 'none',
  background: '#e74c3c',
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 15,
  fontFamily: 'sans-serif',
  touchAction: 'none',
}

const skipStyle = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 13,
  fontFamily: 'sans-serif',
  textDecoration: 'underline',
  touchAction: 'none',
}

function dotStyle(active) {
  return {
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    background: active ? '#e74c3c' : 'rgba(255,255,255,0.3)',
    touchAction: 'none',
  }
}
