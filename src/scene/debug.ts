/**
 * Reproducible frames.
 *
 * The scene is driven by the visitor's clock, live weather, a scroll position
 * and a pointer, which is right for a visitor and useless for checking a
 * render: no two frames are the same, so nothing can be compared before and
 * after a change. These query parameters pin the two variables that matter.
 *
 *   ?hour=19.6   force the time of day
 *   ?stop=3      stand exactly at camera station 3, no easing, no sway
 *
 * Both are inert unless present, so this costs a visitor nothing. It is the
 * `?debug=1` bridge the design handoff asks for, narrowed to the two controls
 * that were actually needed.
 */

function params(): URLSearchParams | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search)
}

/** Forced hour, or null to follow the real clock. */
export function forcedHour(): number | null {
  const v = params()?.get('hour')
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? ((n % 24) + 24) % 24 : null
}

/** Forced camera station index, or null to let scrolling drive it. */
export function forcedStop(): number | null {
  const v = params()?.get('stop')
  if (v == null) return null
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

/** True when the camera should hold perfectly still, for comparable frames. */
export function frozen(): boolean {
  return forcedStop() != null
}

/**
 * Start seated, via `?sit=0`.
 *
 * Sitting down is a click on a marker in the scene, which a screenshot cannot
 * perform, so without this the seated frame and the order panel cannot be
 * checked at all — and they are the two things hardest to get right from
 * arithmetic.
 */
export function forcedSeat(): number | null {
  const v = params()?.get('sit')
  if (v == null) return null
  const n = Number(v)
  return Number.isInteger(n) ? n : null
}

/**
 * Stand-in notes for the wall, via `?napkins=12`.
 *
 * The napkin wall cannot be framed against an empty wall — the whole question
 * is where the block of notes sits in the picture, and with none pinned the
 * answer is always "nowhere". This fills it with plausible traffic so the
 * composition can be judged. It also covers the case where the backend is
 * simply unreachable, which is any environment without the Supabase keys.
 */
const STANDINS = [
  'first one here, as usual',
  'the light at four is the reason',
  'left my gloves on the bench — keeping them warm',
  'told my brother about this place',
  'snowing again',
  'best flat white in the county, admittedly a small county',
  'reading the same page over and over',
  'came for the wifi, stayed for the stove',
  'moose on the road at dawn',
  'back thursday',
  'my daughter drew the barn on a napkin, it is here somewhere',
  'thank you for staying open late',
  'the radio was playing something Malian',
  'quiet enough to hear the boards move',
]

export function standInNapkins(): { id: string; text: string; at: number }[] | null {
  const v = params()?.get('napkins')
  if (v == null) return null
  const n = Math.max(0, Math.min(Number(v) || 0, STANDINS.length))
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => ({
    id: `standin-${i}`,
    text: STANDINS[i],
    // Spread across the seven-day lifetime so the wall shows its age gradient.
    at: now - (i / Math.max(1, n)) * 6.2 * 86400_000,
  }))
}
