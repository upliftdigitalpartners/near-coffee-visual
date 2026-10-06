/**
 * Which photograph of the barn you arrive on.
 *
 * There are four, and they are the same building under four different skies:
 * hazy and soft, bright with the Tetons sharp behind it, hard low light with
 * the creek open, and heavy cloud with the mountains gone altogether. Picking
 * one at random would be worse than using a single image, because the one
 * thing the arrival screen has to do is hand you over to a room that already
 * knows what time it is — and a crisp midday photograph dissolving into a barn
 * lit by a 3am moon is a cut, not a threshold.
 *
 * So the still is chosen on the visitor's own clock, the same clock the scene
 * runs on, and each band carries its own grade in `styles.css` so the match
 * goes further than the choice of file.
 *
 * Weather is deliberately *not* consulted even though the app fetches it. It
 * arrives over the network some hundreds of milliseconds after the overlay is
 * already on screen, and swapping the photograph underneath someone once the
 * forecast lands is a flash, not an improvement. The hour is known
 * synchronously on the first line of the first frame, which is the only thing
 * that is any use here.
 */

export type Sky = 'dawn' | 'day' | 'dusk' | 'night'

/**
 * The bands.
 *
 * Mirrored by the inline script in `index.html`, which runs this same
 * arithmetic before the bundle has parsed so the browser can start fetching
 * the right file immediately. If the two ever disagree the preload simply
 * misses and the image is fetched normally — nothing breaks, it is just
 * slower. This function is the authority; the inline copy is an optimisation.
 */
export function skyFor(hour: number): Sky {
  if (hour >= 5 && hour < 9) return 'dawn'
  if (hour >= 9 && hour < 16) return 'day'
  if (hour >= 16 && hour < 20) return 'dusk'
  return 'night'
}

export function stillFor(sky: Sky): { src: string; srcSet: string } {
  const base = `${import.meta.env.BASE_URL}img/barn-${sky}`
  return {
    src: `${base}.jpg`,
    srcSet: `${base}-sm.jpg 960w, ${base}.jpg 1920w`,
  }
}
