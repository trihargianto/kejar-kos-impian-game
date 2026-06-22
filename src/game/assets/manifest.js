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
  },
  audio: {},
}
