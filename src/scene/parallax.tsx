import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * Parallax.
 *
 * Layers declare a `depth` from 0 (the Grand Teton, effectively at infinity)
 * to 1 (the edge of the table you are sitting at). As the camera translates,
 * an object at distance z shifts across the screen in proportion to 1/z, so
 * near things swing hard and far things barely stir.
 *
 * PIVOT is the depth that stays nailed to the screen — the plane of the
 * window opening. Everything nearer than the window slides one way, the world
 * beyond it slides the other, and the stone reveal scrapes across the range
 * exactly the way it does when you shift in your chair.
 */
const PIVOT = 0.35

/** Maximum travel, in px, for a layer one full unit of depth off the pivot. */
const TRAVEL_X = 58
const TRAVEL_Y = 26

/** How quickly the smoothed offset chases the raw input. */
const EASING = 0.075

type Offset = { x: number; y: number }

const ParallaxContext = createContext<Offset>({ x: 0, y: 0 })

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function ParallaxProvider({ children }: { children: ReactNode }) {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const target = useRef<Offset>({ x: 0, y: 0 })
  const current = useRef<Offset>({ x: 0, y: 0 })

  useEffect(() => {
    if (prefersReducedMotion()) return

    const onPointer = (e: PointerEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }

    /**
     * Tilt, for phones. iOS 13+ gates this behind a permission prompt that
     * must follow a user gesture; rather than throw a modal at someone who
     * just wanted to look at a coffee shop, we only wire up the sensor where
     * it is freely available and let everyone else use touch.
     */
    const needsGyroPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission === 'function'

    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      target.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 35)),
        y: Math.max(-1, Math.min(1, (e.beta - 45) / 35)),
      }
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    if (!needsGyroPermission && typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', onTilt, { passive: true })
    }

    let frame = 0
    const tick = () => {
      const c = current.current
      const t = target.current
      const next = {
        x: c.x + (t.x - c.x) * EASING,
        y: c.y + (t.y - c.y) * EASING,
      }
      current.current = next
      // Only re-render when the movement is actually perceptible.
      if (Math.abs(next.x - c.x) > 0.0004 || Math.abs(next.y - c.y) > 0.0004) {
        setOffset(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('deviceorientation', onTilt)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <ParallaxContext.Provider value={offset}>{children}</ParallaxContext.Provider>
}

type LayerProps = {
  /** 0 = the range at infinity, 1 = your own table edge. */
  depth: number
  children: ReactNode
  className?: string
  /**
   * Layers that fill the frame need a little overscan so parallax travel
   * never drags an edge into view.
   */
  overscan?: boolean
  style?: React.CSSProperties
}

export function Layer({ depth, children, className, overscan = true, style }: LayerProps) {
  const offset = useContext(ParallaxContext)
  const rel = depth - PIVOT
  const x = -offset.x * rel * TRAVEL_X
  const y = -offset.y * rel * TRAVEL_Y
  const scale = overscan ? 1 + Math.abs(rel) * 0.09 : 1

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`,
        willChange: 'transform',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function useParallaxOffset(): Offset {
  return useContext(ParallaxContext)
}
