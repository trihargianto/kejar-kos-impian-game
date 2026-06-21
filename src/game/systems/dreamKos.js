// ─── Kos Impian reveal (curated fallback) ─────────────────────────────────────
// GDD §IX signature mechanic. During a run the player collects facility tags
// (Item Kos Impian); at game over we match that profile to a real-feeling kos
// listing. The live Mamikos API match is Step 3 work — until then this curated
// set keeps the reveal real, unique, and engineering-light (the GDD's explicit
// fallback so a data dependency never blocks the build).
//
// Match = the listing sharing the most tags with the player's profile; ties
// break toward the cheaper kos. With no tags collected, returns a sensible
// default so the screen always has something aspirational to show.

const LISTINGS = Object.freeze([
  { name: 'Kos Putri Melati', area: 'Sleman', price: 850000, tags: ['ac', 'wifi', 'km_dalam'] },
  { name: 'Kos Eksklusif Cendana', area: 'Depok', price: 1500000, tags: ['ac', 'wifi', 'km_dalam', 'parkir', 'dapur'] },
  { name: 'Kos Mawar Asri', area: 'Condongcatur', price: 700000, tags: ['wifi', 'kampus', 'parkir'] },
  { name: 'Kos Anggrek Dekat Kampus', area: 'Caturtunggal', price: 600000, tags: ['kampus', 'wifi'] },
  { name: 'Kos Pak Budi', area: 'Gejayan', price: 550000, tags: ['parkir', 'dapur'] },
  { name: 'Kos Singgahsini Premium', area: 'Babarsari', price: 1800000, tags: ['ac', 'wifi', 'km_dalam', 'kampus', 'parkir', 'dapur'] },
  { name: 'Kos Harmoni', area: 'Maguwoharjo', price: 750000, tags: ['ac', 'km_dalam', 'dapur'] },
  { name: 'Kos Sederhana Berkah', area: 'Seturan', price: 500000, tags: ['wifi'] },
])

const DEFAULT = LISTINGS[2] // Kos Mawar Asri — friendly mid default

// profile: array of { id, count, ... } from CollectibleDirector.dreamProfile().
// Returns one listing record { name, area, price, tags }.
export function matchDreamKos(profile = []) {
  const wanted = new Set(profile.map((p) => p.id))
  if (wanted.size === 0) return DEFAULT

  let best = DEFAULT
  let bestScore = -1
  for (const l of LISTINGS) {
    const overlap = l.tags.filter((t) => wanted.has(t)).length
    if (overlap > bestScore || (overlap === bestScore && l.price < best.price)) {
      best = l
      bestScore = overlap
    }
  }
  return best
}

export function formatPrice(rupiah) {
  return 'Rp ' + rupiah.toLocaleString('id-ID') + '/bulan'
}
