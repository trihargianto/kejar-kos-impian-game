// ─── Kos Impian reveal (budget + tier) ────────────────────────────────────────
// GDD §IX signature mechanic. The run earns two axes from gameplay, both
// computed at game over (nothing tag-like is collected mid-run):
//   1. Budget (rupiah) — from total coins collected this run, clamped to a
//      realistic band. Coins → budget via budgetFromCoins().
//   2. Tier (0..3)     — from distance reached, via the active kasta tier.
// matchDreamKos picks the best listing the player can afford at the highest
// tier they reached. Facility "chips" on the result screen re-roll within the
// same band via matchWithFacility (filter, not a new collection pass).
//
// The live Mamikos API match is Step 3 work; this curated set is the GDD's
// explicit fallback so a data dependency never blocks the build.

// Facility tags used by the result-screen filter chips. Migrated here from
// entities/Collectible.js when mid-run tag collection was removed.
export const FACILITY_TAGS = Object.freeze([
  { id: 'ac', label: 'AC', icon: 'AC' },
  { id: 'wifi', label: 'WiFi', icon: 'WiFi' },
  { id: 'kampus', label: 'Dekat Kampus', icon: 'Kampus' },
  { id: 'km_dalam', label: 'K. Mandi Dalam', icon: 'KM' },
  { id: 'parkir', label: 'Parkir Luas', icon: 'Parkir' },
  { id: 'dapur', label: 'Dapur', icon: 'Dapur' },
])

// The 2-4 chips actually rendered on the result screen (playful re-rolls, not
// the full tag list). Order = display order.
export const REVEAL_CHIPS = Object.freeze(
  ['ac', 'wifi', 'kampus', 'km_dalam'].map(
    (id) => FACILITY_TAGS.find((t) => t.id === id)
  )
)

// Budget band. Tuned so:
//   - a short run (~20-30 coins) lands ~300-500k
//   - a strong run (~250+ coins) approaches the 2jt cap
//   - a 0-coin run falls back to the floor (300k) and the cheapest listing
export const BUDGET_FLOOR = 500_000
export const BUDGET_CEIL = 3_000_000
export const RUPIAH_PER_COIN = 6000

export function budgetFromCoins(coins) {
  const c = Math.max(0, coins | 0)
  return Math.min(BUDGET_CEIL, BUDGET_FLOOR + c * RUPIAH_PER_COIN)
}

// Each listing carries a tier (0..3) matching KASTA_DEFS indices. A listing is
// eligible only if its tier ≤ the player's reached tier. Price + tags drive
// the within-tier sort and the chip re-roll filter.
//
const LISTINGS = Object.freeze([
  { name: 'Kost Anugrah', area: 'Depok Sleman', price: 500000, tier: 0, type: 'Putri', rating: 4.5, photo: 'https://static.mamikos.com/uploads/cache/data/style/2026-04-10/ogZ816wU-540x720.jpg', url: 'https://mamikos.com/room/kost-kabupaten-sleman-kost-putri-murah-kost-anugrah-depok-sleman-2?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Apik Pink Tipe A', area: 'Maguwoharjo Yogyakarta', price: 632200, tier: 0, type: 'Putri', rating: 4.8, photo: 'https://static.mamikos.com/uploads/cache/data/style/2023-11-08/zWQcDGbD-540x720.jpg', url: 'https://mamikos.com/room/kost-sleman-kost-putri-murah-kost-apik-pink-tipe-a-maguwoharjo-yogyakarta-2?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Apik Cengkir Gading House', area: 'Yogyakarta', price: 820000, tier: 1, type: 'Putra', rating: 4.9, photo: 'https://static.mamikos.com/uploads/cache/data/style/2025-03-24/4onYBJlb-540x720.jpg', url: 'https://mamikos.com/room/kost-kabupaten-sleman-kost-putra-murah-kost-apik-cengkir-gading-house-tipe-c-yogyakarta?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Singgahsini Kanaka Allana', area: 'Sinduharjo Yogyakarta', price: 975000, tier: 1, type: 'Putra', rating: 4.6, photo: 'https://static.mamikos.com/uploads/cache/data/style/2021-01-25/u7DsKJ9D-540x720.jpg', url: 'https://mamikos.com/room/kost-sleman-kost-putra-eksklusif-kost-singgahsini-kanaka-allana-tipe-a-sinduharjo-yogyakarta?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Singgahsini Oemah Rajawali', area: 'Yogyakarta', price: 1025000, tier: 1, type: 'Putri', rating: 5.0, photo: 'https://static.mamikos.com/uploads/cache/data/style/2025-09-23/pfFnN3X4-540x720.jpg', url: 'https://mamikos.com/room/kost-kabupaten-sleman-kost-putri-eksklusif-kost-singgahsini-oemah-rajawali-tipe-c-yogyakarta-2?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Singgahsini Alpukat Rania', area: 'Condongcatur', price: 1248000, tier: 2, type: 'Putri', rating: 4.9, photo: 'https://static.mamikos.com/uploads/cache/data/style/2022-02-24/C5YMxcYB-540x720.jpg', url: 'https://mamikos.com/room/kost-sleman-kost-putri-eksklusif-kost-singgahsini-alpukat-rania-tipe-a-condong-catur-yogyakarta-1?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Singgahsini Pondok Garini Syariah', area: 'Yogyakarta', price: 1775000, tier: 2, type: 'Campur', rating: 4.6, photo: 'https://static.mamikos.com/uploads/cache/data/style/2023-09-11/EF4KNLUE-540x720.jpg', url: 'https://mamikos.com/room/kost-kabupaten-sleman-kost-campur-eksklusif-kost-singgahsini-pondok-garini-syariah-tipe-d-yogyakarta?redirection_source=list%20kos%20result', tags: [] },
  { name: 'Kost Singgahsini Green Zee Exclusive', area: 'Condongcatur', price: 2610000, tier: 3, type: 'Campur', rating: 4.5, photo: 'https://static.mamikos.com/uploads/cache/data/style/2026-04-07/lo87x1PS-540x720.jpg', url: 'https://mamikos.com/room/kost-kabupaten-sleman-kost-campur-eksklusif-kost-singgahsini-green-zee-exclusive-tipe-a-condong-catur-yogyakarta-2?redirection_source=list%20kos%20result', tags: [] },
])

// Human labels for facility tag ids, used by the result card's facility line.
export const FACILITY_LABEL = Object.freeze({
  ac: 'AC',
  wifi: 'WiFi',
  kampus: 'Dekat Kampus',
  km_dalam: 'K. Mandi Dalam',
  parkir: 'Parkir Luas',
  dapur: 'Dapur',
})

const CHEAPEST = LISTINGS.reduce((a, b) => (b.price < a.price ? b : a))

// Pick the best listing the player can afford at the highest tier they reached.
// "Best" = highest eligible tier, then priciest still within budget (the most
// aspirational affordable kos in that tier). Always returns something: if
// nothing fits (budget below every listing), returns the cheapest listing.
//
//   budget  rupiah available (from budgetFromCoins)
//   tier    max kasta tier reached this run (0..3)
export function matchDreamKos({ budget, tier } = {}) {
  const elig = LISTINGS.filter((l) => l.tier <= (tier ?? 0) && l.price <= (budget ?? 0))
  if (elig.length === 0) return CHEAPEST
  elig.sort((a, b) =>
    b.tier - a.tier || b.price - a.price
  )
  return elig[0]
}

// Same match, but with affordability context for the result card wording:
//   { kos, affordable, shortfall }
//   affordable  true  → budget covers the kos (price ≤ budget)
//               false → the shown kos (cheapest) costs MORE than the budget, so
//                       the card nudges "add Rp <shortfall> to reach it"
//   shortfall   rupiah still needed when not affordable (0 when affordable)
// Built on matchDreamKos so the matching logic stays single-sourced.
export function matchDreamKosDetailed({ budget, tier } = {}) {
  const kos = matchDreamKos({ budget, tier })
  const b = budget ?? 0
  const affordable = kos.price <= b
  return { kos, affordable, shortfall: affordable ? 0 : kos.price - b }
}

// Chip re-roll: same budget + tier band, but constrained to listings that carry
// the tapped facility. Falls back to the plain match if nothing in-band has
// the facility, so a chip tap always shows something useful.
export function matchWithFacility({ budget, tier, facilityId } = {}) {
  const elig = LISTINGS.filter(
    (l) => l.tier <= (tier ?? 0) && l.price <= (budget ?? 0) && l.tags.includes(facilityId)
  )
  if (elig.length === 0) return matchDreamKos({ budget, tier })
  elig.sort((a, b) => b.tier - a.tier || b.price - a.price)
  return elig[0]
}

export function formatPrice(rupiah) {
  return 'Rp ' + rupiah.toLocaleString('id-ID') + '/bulan'
}
