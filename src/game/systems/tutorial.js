// ─── Tutorial seen-flags ──────────────────────────────────────────────────────
// Tracks which one-time tutorial screens the player has already dismissed, so
// each shows exactly once: the intro (first launch) and the first-pickup
// explainers for Kopi Sachet + Sandal Jepit (GDD §VII power-ups).
//
// Same defensive localStorage pattern as systems/settings.js: in-memory cache,
// try/catch guard around read/parse/write, sanitize to a known shape.
const KEY = 'kki_tutorial'

const DEFAULTS = Object.freeze({ intro: false, kopi: false, sandal: false })

// Card content for each tutorial key, consumed by TutorialOverlay.
//   type 'carousel' → { slides: [{ media, title, body }, ...] } (swipeable)
//   type 'card'     → { media, title, body } (single page)
// `media` is null (placeholder slot) or a video path (e.g. '/tutorials/kopi.mp4')
// to be filled in later — the UI swaps in a <video> without structural change.
// `body` is an array of lines; lines starting with an emoji read as bullets.
export const TUTORIALS = Object.freeze({
  intro: {
    type: 'carousel',
    slides: [
      {
        media: null,
        title: 'KEJAR KOS IMPIAN',
        body: [
          'Sprint menuju kos impianmu!',
          'Tugasmu adalah lari sejauh mungkin dan kumpulkan koin untuk mengejar Kos Impianmu',
        ],
      },
      {
        media: '/tutorials/intro-jump.mp4',
        title: '▶ JUMP',
        body: ['Tekan "JUMP" untuk lompat melewati ember & kucing di lantai.'],
      },
      {
        media: '/tutorials/intro-double-jump.mp4',
        title: '▶▶ DOUBLE JUMP',
        body: ['Tekan "JUMP" sekali lagi di udara untuk jangkau rintangan lebih tinggi.'],
      },
      {
        media: '/tutorials/intro-slide.mp4',
        title: '⬇ SLIDE',
        body: ['Tekan "SLIDE" untuk nunduk supaya lolos dari jemuran & barang terbang.'],
      },
      {
        media: '/tutorials/intro-dash.mp4',
        title: '⚡ DASH',
        body: ['Tekan "DASH" untuk mendobrak pintu yang bisa dihancurkan.'],
      },
      {
        media: '/tutorials/sandal.mp4',
        title: '🩴 THROW',
        body: ['Tekan "THROW" untuk melempar sandal & menghancurkan obstacle di depanmu.'],
      },
    ],
  },
  sandal: {
    type: 'card',
    media: '/tutorials/sandal.mp4',
    title: '🩴 SANDAL JEPIT',
    body: [
      'Senjata pamungkas anak kos!',
      'Tekan tombol THROW untuk melempar sandal & menghancurkan obstacle di depanmu.',
      'Amunisi 3 lemparan — pungut sandal lagi untuk isi ulang.',
    ],
  },
  kopi: {
    type: 'card',
    media: '/tutorials/kopi.mp4',
    title: '☕ KOPI SACHET',
    body: [
      'Langsung nyala begitu dipungut!',
      'Selama ±5 detik kamu ngebut + kebal: terjang obstacle apa pun — pintu hancur, yang lain mental.',
      'Ada durasinya — habis waktunya, kamu balik normal. Manfaatkan!',
    ],
  },
})

// In-memory cache so callers (listeners firing every pickup) don't hit
// localStorage repeatedly.
let _cache = null

function _sanitize(raw) {
  const o = raw && typeof raw === 'object' ? raw : {}
  return {
    intro: !!o.intro,
    kopi: !!o.kopi,
    sandal: !!o.sandal,
  }
}

export function loadTutorial() {
  if (_cache) return _cache
  try {
    const raw = window.localStorage.getItem(KEY)
    _cache = _sanitize(raw ? JSON.parse(raw) : {})
  } catch {
    _cache = { ...DEFAULTS }
  }
  return _cache
}

// Has this tutorial key been dismissed already?
export function seen(key) {
  return !!loadTutorial()[key]
}

// Mark a tutorial as seen (merge + persist). Ignores write failures (private
// mode, quota) — the in-memory cache still reflects the intent for this session.
export function markSeen(key) {
  const next = _sanitize({ ...loadTutorial(), [key]: true })
  _cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore write failures
  }
  return next
}

// Test-only: drop the cache so a fresh load re-reads localStorage.
export function _resetCache() {
  _cache = null
}
