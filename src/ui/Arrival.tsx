import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { present } from '../optional'

/**
 * What you look at while the barn is being built.
 *
 * `Scene.tsx` wrapped everything in `<Suspense fallback={null}>`, and that
 * `null` is the whole problem: an HDRI, a 1.2MB photograph, four 1k PBR maps
 * and about fifteen generated canvases have to be in place before the first
 * frame, and until they are the visitor gets a black rectangle. On a phone on
 * cellular that is several seconds of nothing at all, which is long enough to
 * close the tab.
 *
 * Two things worth being careful about.
 *
 * **Progress is not readiness.** `useProgress` watches three's loading
 * manager, which sees the HDRI and the textures and is blind to the far more
 * expensive half — the procedural materials, which are drawn to canvases
 * synchronously inside `useMemo` and block the main thread while they go.
 * The loader reaches 100% well before the scene can paint. So the bar is
 * driven by the loader, and the *dismissal* is driven by frames actually
 * being rendered: see `Ready` in Scene.tsx.
 *
 * **It has to stand up with no video in it.** `public/video/arrival.mp4` is
 * optional and expected to be absent, so it is probed before a video element
 * is ever created — by content type, not by status, for the reason set out in
 * src/optional.ts. Without it this is the wordmark over a dark room with a
 * warm doorway breathing behind it, which is the building's own palette and
 * is not a placeholder for anything.
 */

const CLIP = `${import.meta.env.BASE_URL}video/arrival.mp4`

export function Arrival({ ready }: { ready: boolean }) {
  const { progress } = useProgress()
  const [gone, setGone] = useState(false)
  const [clip, setClip] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)

  /*
   * Hold the bar at 96 until the scene says it has painted. A bar that sits
   * full while the page is still frozen reads as broken, and this is exactly
   * the moment the main thread is busiest.
   */
  const shown = ready ? 100 : Math.min(96, progress)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let live = true
    present(CLIP, 'video').then((there) => {
      if (live && there) setClip(CLIP)
    })
    return () => {
      live = false
    }
  }, [])

  // Unmount after the fade rather than on `ready`, or the clip is cut off
  // mid-dissolve and the seam is the thing you notice.
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setGone(true), 1100)
    return () => clearTimeout(t)
  }, [ready])

  if (gone) return null

  return (
    <div className={`arrival ${ready ? 'leaving' : ''}`} aria-hidden={ready}>
      {clip && (
        <video
          ref={video}
          className="arrival-clip"
          src={clip}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
      <div className="arrival-glow" />
      <div className="arrival-mark">
        <h1>near coffee</h1>
        <p>a barn on mormon row · open whenever you are</p>
        <div className="arrival-bar">
          <span style={{ transform: `scaleX(${shown / 100})` }} />
        </div>
      </div>
    </div>
  )
}
