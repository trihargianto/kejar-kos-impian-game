import { useCallback, useMemo, useState } from 'react'
import { generateShareImage, GAME_URL } from './systems/shareImage.js'
import { matchDreamKos, budgetFromCoins } from './systems/dreamKos.js'
import { getKastaDef } from './kasta.js'
import { getRank } from './systems/score.js'

// Share / download buttons shown on the game-over screen. The canvas scene owns
// the reveal display (incl. chip re-rolls); the share card uses the DEFAULT
// reveal (budget + tier, no chip) per the GDD UX rule "always show one default
// kos first". Recomputed here from the run summary rather than threaded out of
// the scene, so it stays in sync with matchDreamKos.
//
// Pinned to the top safe area, clear of the reveal card + chips + retry prompt
// the scene draws lower. Every handler stopPropagation so a tap here doesn't
// fall through to the container's tap-to-retry.
export function ShareButtons({ result }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  const dreamKos = useMemo(() => {
    const budget = budgetFromCoins(result.coins ?? 0)
    const tier = getKastaDef(result.dist ?? 0).tier
    return matchDreamKos({ budget, tier })
  }, [result.coins, result.dist])

  const shareText = useMemo(() => {
    const rank = getRank(result.dist ?? 0)
    return (
      `Gue ngejar kos impian sejauh ${result.dist ?? 0} meter!\n` +
      `Pangkat: ${rank}\n` +
      `Kos impianku: ${dreamKos.name}.\n` +
      `Berani ngalahin skor gue? ${GAME_URL}`
    )
  }, [result.dist, dreamKos])

  const onShare = useCallback(
    async (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (busy) return
      setBusy(true)
      setNote(null)
      try {
        const { blob, dataUrl } = await generateShareImage({
          dist: result.dist,
          score: result.score,
          dreamKos,
        })
        const file = new File([blob], 'kejar-kos-impian.png', { type: 'image/png' })
        // Prefer native share-with-image where supported (mobile). Fall back to
        // text-only share, then to a download.
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText, title: 'Kejar Kos Impian' })
        } else if (navigator.share) {
          await navigator.share({ text: shareText, title: 'Kejar Kos Impian' })
        } else {
          download(dataUrl)
          setNote('Gambar diunduh — bagikan ke Story-mu!')
        }
      } catch (err) {
        // AbortError = user cancelled the share sheet; not worth a message.
        if (err?.name !== 'AbortError') setNote('Gagal membagikan. Coba unduh gambar.')
      } finally {
        setBusy(false)
      }
    },
    [busy, result.dist, result.score, dreamKos, shareText]
  )

  const onDownload = useCallback(
    async (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (busy) return
      setBusy(true)
      setNote(null)
      try {
        const { dataUrl } = await generateShareImage({
          dist: result.dist,
          score: result.score,
          dreamKos,
        })
        download(dataUrl)
        setNote('Gambar tersimpan!')
      } catch {
        setNote('Gagal menyimpan gambar.')
      } finally {
        setBusy(false)
      }
    },
    [busy, result.dist, result.score, dreamKos]
  )

  const stop = useCallback((e) => e.stopPropagation(), [])

  return (
    <div
      onClick={stop}
      onTouchStart={stop}
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', gap: 10, pointerEvents: 'auto' }}>
        <ShareBtn onPress={onShare} disabled={busy} primary>
          {busy ? '…' : '📤 Bagikan'}
        </ShareBtn>
        <ShareBtn onPress={onDownload} disabled={busy}>
          ⬇ Unduh
        </ShareBtn>
      </div>
      {note && (
        <div
          style={{
            pointerEvents: 'none',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#f1c40f',
            background: 'rgba(0,0,0,0.45)',
            padding: '4px 10px',
            borderRadius: 8,
          }}
        >
          {note}
        </div>
      )}
    </div>
  )
}

function ShareBtn({ children, onPress, disabled, primary }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPress}
      style={{
        pointerEvents: 'auto',
        padding: '10px 18px',
        borderRadius: 22,
        border: primary ? 'none' : '2px solid rgba(255,255,255,0.5)',
        background: primary ? '#f1c40f' : 'rgba(0,0,0,0.35)',
        color: primary ? '#1a1a1a' : '#fff',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: 15,
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      {children}
    </button>
  )
}

function download(dataUrl) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = 'kejar-kos-impian.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
