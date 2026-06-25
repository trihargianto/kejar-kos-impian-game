import { useMemo } from 'react'
import {
  matchDreamKosDetailed,
  budgetFromCoins,
  formatPrice,
  FACILITY_LABEL,
} from './systems/dreamKos.js'
import { getKastaDef } from './kasta.js'

const rupiah = (n) => 'Rp' + n.toLocaleString('id-ID')

// Mamikos-style result card shown on the game-over screen as a React overlay
// (the canvas can't host a clickable link or load a photo cleanly). It mirrors
// the real Mamikos listing card: photo + type badge, name, area, facilities,
// star rating, price — and the whole card is a link that opens the listing on
// mamikos.com in a NEW TAB.
//
// Uses the DEFAULT reveal (budget from coins + tier from distance, no chip),
// matching ShareButtons, so the headline kos is consistent across the screen.
export function KosCard({ result, onOpen }) {
  const budget = useMemo(() => budgetFromCoins(result.coins ?? 0), [result.coins])

  const { kos, affordable, shortfall } = useMemo(() => {
    const tier = getKastaDef(result.dist ?? 0).tier
    return matchDreamKosDetailed({ budget, tier })
  }, [budget, result.dist])

  const facilities = (kos.tags ?? []).map((t) => FACILITY_LABEL[t] ?? t).join(' · ')

  return (
    <div style={wrapStyle}>
      <div style={leadStyle}>
        <h2 style={headlineStyle}>
          Kamu dapat total koin <b style={{ color: '#f1c40f' }}>{rupiah(budget)}</b>
        </h2>
        <h3 style={funFactStyle}>FUN FACT</h3> <br />
        {affordable ? (
          <>Seandainya kamu lagi nyari kos di mamikos.com, uang segitu bisa dapat kos di sini:</>
        ) : (
          <>
            Sendainya kalau kamu lagi nyari kos di mamikos.com, tinggal nambahin{` `}
            <b>{rupiah(shortfall)}</b> lagi, kamu bisa dapat kos kaya gini loh:
          </>
        )}
      </div>

      {/* Whole card is the link → opens the Mamikos listing in a new tab. */}
      <a
        href={kos.url}
        target="_blank"
        rel="noopener noreferrer"
        className="game-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onOpen?.(kos)}
        style={cardStyle}
      >
        {/* Photo + type badge */}
        <div style={photoStyle(kos.photo)}>
          {!kos.photo && <span style={photoFallbackIcon}>🏠</span>}
          <span style={badgeStyle}>{kos.type ?? 'Campur'}</span>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <div style={nameStyle}>{kos.name}</div>
          <div style={areaStyle}>{kos.area}</div>
          {facilities && <div style={facStyle}>{facilities}</div>}
          <div style={ratingRow}>
            <span style={{ color: '#22c55e', fontSize: 15 }}>★</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{(kos.rating ?? 4.5).toFixed(1)}</span>
          </div>
          <div style={priceStyle}>{formatPrice(kos.price)}</div>
          <div style={ctaStyle}>Lihat di Mamikos →</div>
        </div>
      </a>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const wrapStyle = {
  position: 'absolute',
  left: '50%',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
  transform: 'translateX(-50%)',
  width: 'min(86%, 320px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 10,
  zIndex: 12,
  pointerEvents: 'none', // only the card itself is interactive
}

const leadStyle = {
  textAlign: 'center',
  fontFamily: 'sans-serif',
  fontSize: 13,
  lineHeight: 1.45,
  color: 'rgba(255,255,255,0.85)',
}

const headlineStyle = {
  margin: '0 0 18px',
  fontSize: 18,
  fontWeight: 800,
  lineHeight: 1.3,
  color: '#fff',
}

const funFactStyle = {
  display: 'inline-block',
  margin: '0 auto 6px',
  padding: '2px 10px',
  borderRadius: 999,
  background: 'rgba(241,196,15,0.18)',
  border: '1px solid rgba(241,196,15,0.5)',
  color: '#f1c40f',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.5,
}

const cardStyle = {
  pointerEvents: 'auto',
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  color: '#1a1a1a',
  background: '#fff',
  borderRadius: 14,
  overflow: 'hidden',
  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
}

const photoStyle = (photo) => ({
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 10',
  background: photo
    ? `center / cover no-repeat url(${photo})`
    : 'linear-gradient(135deg, #cfe0f0, #9bbdd8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const photoFallbackIcon = { fontSize: 44, opacity: 0.7 }

const badgeStyle = {
  position: 'absolute',
  left: 10,
  top: 10,
  padding: '4px 12px',
  borderRadius: 8,
  background: '#fff',
  color: '#1a1a1a',
  fontFamily: 'sans-serif',
  fontWeight: 700,
  fontSize: 13,
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
}

const bodyStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 14px 14px',
  fontFamily: 'sans-serif',
  textAlign: 'left',
}

const nameStyle = {
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const areaStyle = { fontSize: 15, fontWeight: 700 }

const facStyle = {
  fontSize: 13,
  color: '#999',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const ratingRow = { display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }

const priceStyle = { fontSize: 17, fontWeight: 700, marginTop: 2 }

const ctaStyle = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 700,
  color: '#e74c3c',
}
