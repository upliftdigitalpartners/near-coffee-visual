import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

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
 * Sitting at a table at the back, and standing just short of the doorway.
 *
 * The end of the walk deliberately stops *inside* the barn. Taking it all the
 * way to the threshold puts the whole building behind you and leaves nothing
 * on screen but the photograph, which throws away the only thing that makes
 * the view worth anything — the doorway around it.
 */
const SEATED = new THREE.Vector3(0.9, 1.22, 4.3)
const DOORWAY = new THREE.Vector3(0, 1.52, 0.6)

const LOOK_SEATED = new THREE.Vector3(-0.2, 1.5, -6)
const LOOK_DOORWAY = new THREE.Vector3(0, 1.85, -30)

/** How far the pointer can swing the view, in radians. */
const YAW_RANGE = 0.26
const PITCH_RANGE = 0.14

export function CameraRig({ onProgress }: { onProgress?: (p: number) => void }) {
  const { camera } = useThree()

  const pointer = useRef({ x: 0, y: 0 })
  const smoothed = useRef({ x: 0, y: 0 })
  const targetProgress = useRef(0)
  const progress = useRef(0)
  const velocity = useRef(0)

  const position = useRef(SEATED.clone())
  const lookAt = useRef(LOOK_SEATED.clone())

  useEffect(() => {
    camera.position.copy(SEATED)
    camera.lookAt(LOOK_SEATED)
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
      velocity.current += e.deltaY * 0.00035
    }

    let touchY: number | null = null
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (y == null || touchY == null) return
      velocity.current += (touchY - y) * 0.0016
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

    // Coast, then settle.
    targetProgress.current = THREE.MathUtils.clamp(
      targetProgress.current + velocity.current,
      0,
      1,
    )
    velocity.current *= Math.pow(0.02, dt)
    progress.current = THREE.MathUtils.damp(progress.current, targetProgress.current, 3.2, dt)
    onProgress?.(progress.current)

    // Ease the walk so it settles into each end rather than arriving flat.
    const p = progress.current * progress.current * (3 - 2 * progress.current)

    position.current.lerpVectors(SEATED, DOORWAY, p)
    lookAt.current.lerpVectors(LOOK_SEATED, LOOK_DOORWAY, p)

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
