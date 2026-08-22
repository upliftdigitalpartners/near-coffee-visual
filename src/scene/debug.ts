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
