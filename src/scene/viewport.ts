import { useEffect, useState } from 'react'

/**
 * The scene is drawn in a 1000x700 design space and every layer renders it
 * with `slice`, so the browser crops rather than letterboxes.
 *
 * On a wide screen that is what you want. On a phone it is a disaster: to
 * cover an 812-tall viewport the browser scales up ~1.16x and you end up
 * looking at a third of the width — the window fills the screen, the counter
 * and the table are gone, and the room stops being a room.
 *
 * So on portrait we hand the SVG a much taller viewBox. Same artwork, but the
 * scale factor drops enough to bring the full width of the room back into
 * frame, and the extra height is taken up by ceiling above and floor below.
 * Everything that draws a background therefore has to extend well past the
 * nominal 0..700 band — see the EXTENT constants below.
 */

export const DESIGN_W = 1000
export const DESIGN_H = 700

/** How far the artwork runs beyond the design band, for the portrait crop. */
export const EXTENT_TOP = -520
export const EXTENT_BOTTOM = 1260

const LANDSCAPE = `0 0 ${DESIGN_W} ${DESIGN_H}`
/*
 * Tuned by eye on a 375x812 phone. Taller than this and the room shrinks into
 * a band with dead ceiling above and dead table below; shorter and the counter
 * and lamp get cropped off the left edge.
 */
const PORTRAIT = `0 -300 ${DESIGN_W} 1340`

export function useSceneViewBox(): string {
  const [viewBox, setViewBox] = useState(LANDSCAPE)

  useEffect(() => {
    const update = () => {
      const wide = window.innerWidth / window.innerHeight >= 1.05
      setViewBox(wide ? LANDSCAPE : PORTRAIT)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return viewBox
}

/** Shared props for every layer that draws into the scene. */
export type LayerSvgProps = { viewBox: string }

export const svgStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
}
