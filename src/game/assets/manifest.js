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
    'player:dash': 'sprites/player_dash.png',
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
    // Backgrounds — parallax wall tile per kasta
    'bg:kipas_angin': 'sprites/bg_kipas_angin.png',
    'bg:ac_standar': 'sprites/bg_ac_standar.png',
    'bg:singgahsini': 'sprites/bg_singgahsini.png',
    'bg:kos_impian': 'sprites/bg_kos_impian.png',
    // UI
    'ui:logo': 'sprites/ui_logo.png',
  },
  audio: {
    'sfx:menu_tap': 'audio/sfx_menu_tap.mp3',
    'sfx:jump': 'audio/sfx_jump.mp3',
    'sfx:crash': 'audio/sfx_crash.mp3',
    'sfx:punch': 'audio/sfx_punch.mp3',
    'sfx:hit': 'audio/sfx_hit.mp3',
    'sfx:coin': 'audio/sfx_coin.mp3',
    'sfx:dash': 'audio/sfx_dash.mp3',
    'sfx:slide': 'audio/sfx_slide.mp3',
    'sfx:kopi_1': 'audio/sfx_kopi_1.mp3',
    'sfx:kopi_2': 'audio/sfx_kopi_2.mp3',
    'sfx:kopi_3': 'audio/sfx_kopi_3.mp3',
    'sfx:kopi_4': 'audio/sfx_kopi_4.mp3',
    'music:home': 'audio/music_home.mp3',
  },
}
