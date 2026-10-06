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
 * This used to be the wordmark over a dark rectangle with a warm patch
 * breathing behind it, which was defensible but was still, in the end, a
 * black screen with a spinner on it. It is now a photograph of the building
 * you are about to be standing inside, full bleed, with a slow push on it.
 * That is a better use of the four seconds for a reason beyond decoration:
 * the scene opens *inside* the barn, so without this nobody ever sees the
 * barn from the outside, in the snow, on the plain — which is the entire
 * premise of the place and is unrecoverable once you are through the door.
 *
 * Three things worth being careful about.
 *
 * **Progress is not readiness.** `useProgress` watches three's loading
 * manager, which sees the HDRI and the textures and is blind to the far more
 * expensive half — the procedural materials, which are drawn to canvases
 * synchronously inside `useMemo` and block the main thread while they go.
 * The loader reaches 100% well before the scene can paint. So the bar is
 * driven by the loader, and the *dismissal* is driven by frames actually
 * being rendered: see `Ready` in Scene.tsx.
 *
 * **The mark does not move when the overlay goes.** It is set at the same
 * gutter as the real masthead in `.sign`, so as this fades out the name is
 * already where it is about to be, only larger. The eye reads that as one
 * object settling rather than two things swapping over, which is most of why
 * the transition does not feel like a loading screen being dismissed.
 *
 * **It has to stand up with no video in it.** `public/video/arrival.mp4` is
 * optional and expected to be absent, so it is probed before a video element
 * is ever created — by content type, not by status, for the reason set out in
 * src/optional.ts. The photograph is the default and is not a placeholder for
 * it; the clip, if it ever arrives, dissolves in on top.
 */

const CLIP = `${import.meta.env.BASE_URL}video/arrival.mp4`
const STILL = `${import.meta.env.BASE_URL}img/barn.jpg`
const STILL_SM = `${import.meta.env.BASE_URL}img/barn-sm.jpg`

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
      <img
        className="arrival-still"
        src={STILL}
        srcSet={`${STILL_SM} 960w, ${STILL} 1920w`}
        sizes="100vw"
        alt=""
        /* The one image on the page that must not be lazy: it is the whole
           first frame. `fetchPriority` moves it ahead of the HDRI, which the
           visitor cannot see yet and will not miss for 300ms. */
        fetchPriority="high"
        decoding="async"
      />
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
      <div className="arrival-shade" />

      <header className="arrival-mark">
        <h1>
          <span>Near</span>
          <span>Coffee</span>
        </h1>
        <p>Mormon Row, Wyoming</p>
      </header>

      <div className="arrival-foot">
        <span className="arrival-state">
          {ready ? 'the door is open' : 'laying the fire'}
        </span>
        <div className="arrival-bar">
          <span style={{ transform: `scaleX(${shown / 100})` }} />
        </div>
        <span className="arrival-pct">{String(Math.round(shown)).padStart(2, '0')}</span>
      </div>
    </div>
  )
}
