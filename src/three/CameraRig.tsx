import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forcedStop } from '../scene/debug'

/**
 * The camera.
 *
 * Everything here is damped rather than set. A camera that tracks the pointer
 * exactly feels like a diagram; a camera that takes a moment to get there, and
 * overshoots slightly on the way, feels like a head turning. THREE.MathUtils
 * .damp is used throughout so the feel is identical at 60fps and 120fps —
 * lerping by a fixed fraction per frame silently doubles the speed on a
 * ProMotion display, which is the usual reason this sort of motion feels
 * different on different machines.
 *
 * Scrolling walks you from your table at the back of the barn up to the open
 * door. It is a dolly, not a page scroll — there is no page.
 */

/**
 * Where you can be, in order.
 *
 * One scroll used to take you from the table to the door and that was the
 * whole building — which meant most of the barn was scenery you could never
 * turn to look at. Now scrolling walks a route, and each stop is a place
 * somebody would actually stand: your table, the counter where the coffee
 * happens, the wall people leave notes on, and finally the doorway.
 *
 * Positions are eased and damped between, so it reads as walking rather than
 * cutting. Stops are deliberately unevenly spaced along the scroll — the
 * distance between the counter and the wall is short in the room and short on
 * the wheel too.
 */
type Station = {
  /** Where the camera stands. */
  at: THREE.Vector3
  /** What it is looking at. */
  look: THREE.Vector3
  /** Name, shown quietly while you are there. */
  label: string
}

const STATIONS: Station[] = [
  {
    at: new THREE.Vector3(0.9, 1.22, 4.3),
    look: new THREE.Vector3(-0.2, 1.5, -6),
    label: 'your table',
  },
  {
    at: new THREE.Vector3(1.9, 1.5, 2.6),
    look: new THREE.Vector3(5.2, 1.35, 1.4),
    label: 'the counter',
  },
  {
    at: new THREE.Vector3(-1.1, 1.5, 0.4),
    look: new THREE.Vector3(-5.4, 1.9, -3.6),
    label: 'the wall',
  },
  {
    at: new THREE.Vector3(2.2, 1.5, -0.6),
    look: new THREE.Vector3(4.6, 2.3, -3.9),
    label: "today's bake",
  },
  {
    at: new THREE.Vector3(0, 1.52, 0.6),
    look: new THREE.Vector3(0, 1.85, -30),
    label: 'the doorway',
  },
]

/** How far the pointer can swing the view, in radians. */
const YAW_RANGE = 0.26
const PITCH_RANGE = 0.14

export function CameraRig({
  onProgress,
  onStation,
}: {
  onProgress?: (p: number) => void
  onStation?: (label: string) => void
}) {
  const { camera } = useThree()

  const pointer = useRef({ x: 0, y: 0 })
  const smoothed = useRef({ x: 0, y: 0 })
  const targetProgress = useRef(0)
  const progress = useRef(0)
  const velocity = useRef(0)

  const position = useRef(STATIONS[0].at.clone())
  const lookAt = useRef(STATIONS[0].look.clone())
  const lastLabel = useRef('')

  useEffect(() => {
    camera.position.copy(STATIONS[0].at)
    camera.lookAt(STATIONS[0].look)
  }, [camera])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return
      pointer.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      }
    }

    /*
     * Wheel feeds velocity rather than position, so a trackpad flick carries
     * and coasts to a stop instead of stopping dead with your fingers.
     */
    const onWheel = (e: WheelEvent) => {
      velocity.current += e.deltaY * 0.00022
    }

    let touchY: number | null = null
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (y == null || touchY == null) return
      velocity.current += (touchY - y) * 0.0010
      touchY = y
      // Tilt the view with the thumb, since there is no pointer on a phone.
      pointer.current = {
        x: (e.touches[0].clientX / window.innerWidth) * 2 - 1,
        y: (y / window.innerHeight) * 2 - 1,
      }
    }
    const onTouchEnd = () => {
      touchY = null
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)

    /*
     * Pinned to one station for a comparable frame. No easing, no breath, no
     * pointer sway — otherwise every screenshot is taken from a slightly
     * different place and framing cannot be judged at all.
     */
    const pin = forcedStop()
    if (pin != null) {
      const s = STATIONS[THREE.MathUtils.clamp(pin, 0, STATIONS.length - 1)]
      camera.position.copy(s.at)
      camera.lookAt(s.look)
      return
    }

    // Coast, then settle.
    targetProgress.current = THREE.MathUtils.clamp(
      targetProgress.current + velocity.current,
      0,
      1,
    )
    velocity.current *= Math.pow(0.02, dt)
    progress.current = THREE.MathUtils.damp(progress.current, targetProgress.current, 3.2, dt)
    onProgress?.(progress.current)

    /*
     * Walk the station list. The eased fraction is taken *within* each leg
     * rather than across the whole route, so the camera settles into every
     * stop instead of gliding through the middle ones at speed.
     */
    const legs = STATIONS.length - 1
    const scaled = THREE.MathUtils.clamp(progress.current, 0, 1) * legs
    const i = Math.min(Math.floor(scaled), legs - 1)
    const raw = scaled - i
    const p = raw * raw * (3 - 2 * raw)

    position.current.lerpVectors(STATIONS[i].at, STATIONS[i + 1].at, p)
    lookAt.current.lerpVectors(STATIONS[i].look, STATIONS[i + 1].look, p)
    const label = p < 0.5 ? STATIONS[i].label : STATIONS[i + 1].label
    if (label !== lastLabel.current) {
      lastLabel.current = label
      onStation?.(label)
    }

    smoothed.current.x = THREE.MathUtils.damp(smoothed.current.x, pointer.current.x, 2.6, dt)
    smoothed.current.y = THREE.MathUtils.damp(smoothed.current.y, pointer.current.y, 2.6, dt)

    // Breathing. Small enough to be felt rather than seen.
    const t = state.clock.elapsedTime
    const breath = Math.sin(t * 0.62) * 0.012 + Math.sin(t * 0.24) * 0.018

    camera.position.set(
      position.current.x + smoothed.current.x * 0.34,
      position.current.y + breath - smoothed.current.y * 0.1,
      position.current.z,
    )

    const target = lookAt.current.clone()
    target.x -= smoothed.current.x * YAW_RANGE * 12
    target.y -= smoothed.current.y * PITCH_RANGE * 12
    camera.lookAt(target)
  })

  return null
}
