// ─── Asset manifest ───────────────────────────────────────────────────────────
// Maps asset ids → file paths under public/ (served from the site root). Loaded
// once at boot by Game via AssetLoader.load(). Entities look assets up by id and
// fall back to placeholder rendering when has(id) is false, so this list can
// grow one sprite at a time without breaking the game (GDD §XVI Step 4).
//
// id convention: 'type:name' → file 'type_name.png'. Add entries here as art
// lands; missing files just warn and the entity keeps its placeholder.
export const MANIFEST = {
  images: {
    'player:run': 'sprites/player_run.png',
    'player:slide': 'sprites/player_slide.png',
    'player:jump': 'sprites/player_jump.png',
    'player:hurt': 'sprites/player_hurt.png',
    // Obstacles — Kipas Angin (tier 0). Tall pintu is authored at 3:1 and
    // stretched vertically to the hitbox by Obstacle.draw.
    'obs:ember': 'sprites/obs_ember.png',
    'obs:kucing': 'sprites/obs_kucing.png',
    'obs:jemuran': 'sprites/obs_jemuran.png',
    'obs:burung': 'sprites/obs_burung.png',
    'obs:sandal_lempar': 'sprites/obs_sandal_lempar.png',
    'obs:pintu': 'sprites/obs_pintu.png',
    // AC Standar (tier 1)
    'obs:galon': 'sprites/obs_galon.png',
    'obs:galon_lempar': 'sprites/obs_galon_lempar.png',
    // Singgahsini (tier 2). smartlock authored 3:1, stretched to the hitbox.
    'obs:monstera': 'sprites/obs_monstera.png',
    'obs:vacuum': 'sprites/obs_vacuum.png',
    'obs:smartlock': 'sprites/obs_smartlock.png',
    // Collectibles + power-ups (GDD §VII)
    'item:coin': 'sprites/item_coin.png',
    'item:kopi': 'sprites/item_kopi.png',
    'item:sandal': 'sprites/item_sandal.png',
    // Backgrounds — parallax wall tile per kasta (only Kipas Angin so far)
    'bg:kipas_angin': 'sprites/bg_kipas_angin.png',
    // UI
    'ui:logo': 'sprites/ui_logo.png',
  },
  audio: {},
}
