import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { forcedStop } from '../scene/debug'
import { clampToZones, floorAt, zoneAt } from '../scene/zones'
import type { Seat } from '../scene/seats'

/**
 * Walking, rather than being carried.
 *
 * This used to be a rail: scrolling advanced a parameter and the camera was
 * placed along a fixed route of five stops. It made every frame composable,
 * which is why the stops could be framed shot by shot — and it meant the barn
 * was a corridor. You could look at the counter but never stand beside it, and
 * nothing behind you existed because you could never turn round.
 *
 * So the rail is gone and the anchors survive as somewhere to *go*, not
 * somewhere you are put. The cost is real and worth stating: a visitor can now
 * stand anywhere, including places nobody composed, so the scene has to hold up
 * from everywhere rather than from five points. That is the trade the handoff
 * always intended — its camera section is free movement with named anchors —
 * and it is the difference between a slideshow of a coffee shop and a coffee
 * shop.
 *
 * Three ways to move, because the obvious one does not exist on a phone:
 *
 *   drag        look around, on pointer and touch alike
 *   W/S, wheel  walk forward and back; A/D turn, Q/E strafe
 *   tap a spot  walk there
 *
 * The last is the one that makes this work on a phone at all. Dragging is
 * spent on looking, so touch has nothing left for walking, and the handoff
 * simply does not say what a phone should do. Tapping the floor is the oldest
 * answer in browser 3D and needs no instructions.
 */

type Station = {
  /** Where the camera stands. */
  at: THREE.Vector3
  /** What it is looking at. */
  look: THREE.Vector3
  /** Name, shown quietly while you are there. */
  label: string
}

/**
 * Named places, kept from the rail.
 *
 * They are no longer a route — nothing walks between them in order — but they
 * are still the six spots worth being, and they are what `?stop=` pins for a
 * reproducible frame.
 */
export const STATIONS: Station[] = [
  {
    at: new THREE.Vector3(0.85, 1.3, 4.55),
    look: new THREE.Vector3(0.05, 0.72, -3.5),
    label: 'your table',
  },
  {
    at: new THREE.Vector3(2.9, 1.6, 3.6),
    look: new THREE.Vector3(4.2, 1.15, -0.8),
    label: 'the counter',
  },
  {
    at: new THREE.Vector3(-2.45, 1.55, -1.35),
    look: new THREE.Vector3(-3.9, 1.88, -3.91),
    label: 'the wall',
  },
  {
    at: new THREE.Vector3(3.05, 1.62, -0.85),
    look: new THREE.Vector3(3.5, 2.08, -3.89),
    label: "today's bake",
  },
  {
    at: new THREE.Vector3(2.3, 1.62, 2.9),
    look: new THREE.Vector3(0.6, 1.02, -5.5),
    label: 'the doorway',
  },
  {
    /*
     * Just through the hatch, looking down the length of the room rather than
     * into the oven. Aimed at the oven from two metres, which is where this
     * started, the frame is one glowing slab and you cannot tell it is a room
     * at all — the bench, the racks and the low ceiling are the things that
     * say bakery, and the oven only has to be at the end of them.
     */
    at: new THREE.Vector3(2.55, 1.58, 6.55),
    look: new THREE.Vector3(2.0, 1.15, 9.4),
    label: 'the bakery',
  },
  {
    /*
     * At the inner edge of the deck, twelve degrees down.
     *
     * Standing on a porch, the porch is the hardest thing to see. The deck is
     * 1.54m below the eye, so it runs from 27 degrees down at its far edge to
     * straight down at your feet — and a 46 degree frame catches almost none
     * of that at eye level. Two earlier attempts both came back as pure
     * photograph with a 15cm sliver of board in one corner, and both times the
     * instinct to fix it by pitching further down was backwards: pitching down
     * reveals the deck *nearer*, and near deck is exactly what is already
     * outside the frame.
     *
     * What sets it is the far edge. Standing at the wall rather than out on
     * the boards puts that edge 3m away at -27 degrees; a 12 degree pitch then
     * lands the frame's bottom at -35, which is 2.2m out, and about 0.85m of
     * deck reads across the bottom of the picture. The peaks land just inside
     * the top at +22.
     *
     * The roof cannot be in this shot at any angle — deck edge and roof edge
     * are 67 degrees apart from under it. It reads from inside the barn
     * instead, as the band across the head of the doorway, which is where it
     * does its real work.
     */
    at: new THREE.Vector3(0.6, 1.62, -4.15),
    look: new THREE.Vector3(2.0, -1.36, -18),
    label: 'the porch',
  },
]

/** Standing eye height, per the handoff. */
const EYE = 1.58

const WALK = 1.5
const TURN = 1.5
const PITCH_MIN = -0.55
const PITCH_MAX = 0.45
/** A drag longer than this is a look, not a tap. */
const TAP_SLOP = 6

export function CameraRig({
  onProgress,
  onStation,
  seat,
}: {
  onProgress?: (p: number) => void
  onStation?: (label: string) => void
  /** Non-null while seated. Walking is suspended; looking is not. */
  seat?: Seat | null
}) {
  const { camera, gl } = useThree()

  const pos = useRef(new THREE.Vector3(0.85, EYE, 4.55))
  const yaw = useRef(Math.PI)
  const pitch = useRef(-0.05)
  const walkTo = useRef<THREE.Vector3 | null>(null)
  const keys = useRef<Record<string, boolean>>({})
  const moved = useRef(false)
  const lastLabel = useRef('')
  const seated = useRef<Seat | null>(null)
  const standAt = useRef(new THREE.Vector3(0.85, EYE, 4.55))

  useEffect(() => {
    /*
     * Aim at the door from the starting table. atan2 of (x, z) rather than
     * (z, x): yaw 0 looks down -Z in three's convention, so the arguments are
     * the other way round from the usual maths convention, and getting it
     * backwards starts every visitor facing the back wall.
     */
    const d = new THREE.Vector3(0.05, 0, -3.5).sub(pos.current)
    yaw.current = Math.atan2(-d.x, -d.z)
    pitch.current = -0.04
  }, [])

  /*
   * Taking a seat, and getting up again.
   *
   * Where you were standing is remembered, so standing up puts you back on
   * your feet where you left them rather than teleporting you to the middle of
   * the room — which is disorienting in a way that is hard to name until it
   * happens to you.
   */
  useEffect(() => {
    if (seat) {
      if (!seated.current) standAt.current.copy(pos.current)
      seated.current = seat
      const d = seat.look.clone().sub(seat.at)
      yaw.current = Math.atan2(-d.x, -d.z)
      pitch.current = THREE.MathUtils.clamp(
        Math.atan2(d.y, Math.hypot(d.x, d.z)),
        PITCH_MIN,
        PITCH_MAX,
      )
      walkTo.current = null
    } else if (seated.current) {
      seated.current = null
      pos.current.copy(standAt.current)
    }
  }, [seat])

  useEffect(() => {
    const el = gl.domElement
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dragging = false
    let lastX = 0
    let lastY = 0
    let downX = 0
    let downY = 0

    const onDown = (e: PointerEvent) => {
      dragging = true
      lastX = downX = e.clientX
      lastY = downY = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      if (reduced) return
      // Rates straight from the handoff.
      yaw.current -= dx * 0.0032
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - dy * 0.0026,
        PITCH_MIN,
        PITCH_MAX,
      )
      moved.current = true
    }

    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      el.releasePointerCapture?.(e.pointerId)
      const slop = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (slop > TAP_SLOP) return
      // Seated, a tap on the floor is not a request to walk there. Getting up
      // is a deliberate act, and it has its own button.
      if (seated.current) return

      /*
       * A tap. Cast the pointer at the floor plane analytically rather than
       * raycasting the scene: the floor is y = 0 everywhere, and a real
       * raycast would happily return a hit on the counter top or a napkin and
       * walk you into the furniture.
       */
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, camera)
      // Looking at or above the horizon can never hit the floor in front of
      // you; without this the intersection lands behind the camera.
      if (ray.ray.direction.y > -0.02) return
      const hit = new THREE.Vector3()
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return
      if (!zoneAt(hit.x, hit.z)) return
      walkTo.current = hit
      moved.current = true
    }

    const onWheel = (e: WheelEvent) => {
      if (seated.current) return
      pos.current.addScaledVector(forward(yaw.current), -e.deltaY * 0.0016)
      walkTo.current = null
      moved.current = true
    }

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keys.current[k] = e.type === 'keydown'
        if (e.type === 'keydown') {
          walkTo.current = null
          moved.current = true
        }
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [camera, gl])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)

    /* Pinned to one anchor for a comparable frame. See scene/debug.ts. */
    const pin = forcedStop()
    if (pin != null) {
      const s = STATIONS[THREE.MathUtils.clamp(pin, 0, STATIONS.length - 1)]
      camera.position.copy(s.at)
      camera.lookAt(s.look)
      return
    }

    /*
     * Seated. The head is pinned to the seat and only the neck works — which
     * is the entire difference, and is why sitting down reads as sitting down
     * rather than as being moved somewhere shorter.
     */
    const chair = seated.current
    if (chair) {
      const t = state.clock.elapsedTime
      // Slower and deeper than standing, per the handoff.
      const breath = Math.sin(t * 0.44) * 0.02 + Math.sin(t * 0.19) * 0.024
      camera.position.set(chair.at.x, chair.at.y + breath, chair.at.z)
      camera.quaternion.setFromEuler(
        new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'),
      )
      if (chair.label !== lastLabel.current) {
        lastLabel.current = chair.label
        onStation?.(chair.label)
      }
      return
    }

    const k = keys.current
    const ahead = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0)
    const side = (k.e ? 1 : 0) - (k.q ? 1 : 0)
    const turn = (k.arrowleft || k.a ? 1 : 0) - (k.arrowright || k.d ? 1 : 0)

    if (turn) yaw.current += turn * TURN * dt
    if (ahead) pos.current.addScaledVector(forward(yaw.current), ahead * WALK * dt)
    if (side) pos.current.addScaledVector(right(yaw.current), side * WALK * dt)

    // Walking to a tapped spot, and turning to face it on the way.
    if (walkTo.current) {
      const to = walkTo.current
      const dx = to.x - pos.current.x
      const dz = to.z - pos.current.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.14) {
        walkTo.current = null
      } else {
        const step = Math.min(WALK * dt, dist)
        pos.current.x += (dx / dist) * step
        pos.current.z += (dz / dist) * step
        const want = Math.atan2(-dx, -dz)
        // Shortest way round, or a walk east turns the long way through west.
        let d = ((want - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
        if (d < -Math.PI) d += Math.PI * 2
        yaw.current += d * Math.min(1, dt * 3.2)
      }
    }

    const [cx, cz] = clampToZones(pos.current.x, pos.current.z)
    pos.current.x = cx
    pos.current.z = cz

    // Breathing. Small enough to be felt rather than seen.
    const t = state.clock.elapsedTime
    const breath = Math.sin(t * 0.62) * 0.012 + Math.sin(t * 0.24) * 0.018
    const bob = ahead || walkTo.current ? Math.sin(t * 7.4) * 0.016 : 0

    camera.position.set(
      pos.current.x,
      floorAt(cx, cz) + EYE + breath + bob,
      pos.current.z,
    )
    camera.quaternion.setFromEuler(
      new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'),
    )

    if (moved.current) {
      onProgress?.(1)
      moved.current = false
    }

    // Whichever named place you are nearest, for the label in the corner.
    let best = STATIONS[0]
    let bestD = Infinity
    for (const s of STATIONS) {
      const d = s.at.distanceToSquared(camera.position)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (best.label !== lastLabel.current) {
      lastLabel.current = best.label
      onStation?.(best.label)
    }
  })

  return null
}

function forward(y: number): THREE.Vector3 {
  return new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y))
}

function right(y: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(y), 0, -Math.sin(y))
}
