// ─── In-game prompt director ──────────────────────────────────────────────────
// Fires the milestone story prompts from GDD §VIII once each, in order, as the
// player crosses distance thresholds. Keeps the arah "MENUJU kos impian"
// consistent (destination ahead, Ibu Kos pressure behind).
//
// Stateless-ish: holds only the index of the next prompt. The scene asks for a
// prompt each frame via check(dist) and renders/floats whatever comes back.

export const PROMPTS = Object.freeze([
  { at: 0, text: 'Tanggal tua, dompet kering — kabur ke kos impian!' },
  { at: 200, text: 'Kos impian makin keliatan! Gas terus!' },
  { at: 500, text: 'Setengah jalan ke kos idaman — jangan ketarik balik!' },
  { at: 800, text: 'Dikit lagi sampai kos impian! Ayo!' },
  { at: 1000, text: 'Kos impian di depan mata! Sprint pamungkas!' },
])

export class PromptDirector {
  constructor() {
    this.next = 0
  }

  reset() {
    this.next = 0
  }

  // Returns the prompt text to show this frame, or null. Advances past any
  // thresholds already crossed so a big dt never skips a prompt silently.
  check(dist) {
    let fired = null
    while (this.next < PROMPTS.length && dist >= PROMPTS[this.next].at) {
      fired = PROMPTS[this.next].text
      this.next++
    }
    return fired
  }
}
