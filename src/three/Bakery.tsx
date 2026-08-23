import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { BARN } from './Barn'
import { chamferedBox, GRAIN, plankUVs, useWoodMaps, useWoodMaterial } from './wood'
import type { SceneLight } from './lighting'
import { useSoapstone } from './surfaces'

/**
 * The bakery, through the gap in the back wall.
 *
 * A lean-to on the back of the barn, which is what these actually are — the
 * homestead barns on Mormon Row grew sheds off whichever wall needed one, and a
 * bakery wants a low ceiling and a stone floor far more than it wants the
 * barn's eight metres of cold air over its head.
 *
 * It is the same continuous world, not a scene: you walk through the hatch and
 * you are in it. That is why the ceiling is 2.9m rather than the barn's ridge —
 * stepping from a tall volume into a low one is most of what makes a doorway
 * feel like a doorway, and it costs nothing but a number.
 *
 * The oven is the reason to come in here. It throws the only warm light in the
 * building that is not a bulb, it flickers, and at any hour it is the brightest
 * thing in the room — so the bakery reads as occupied even when the barn is
 * dark.
 */

const B = {
  x0: 0.2,
  x1: 4.4,
  z0: BARN.backZ,
  z1: 9.8,
  ceiling: 2.9,
} as const

/** Long side of a plank wall, matching the barn's construction. */
function boardWall(opts: {
  seed: number
  u0: number
  u1: number
  height: number
  place: (u: number, y: number) => [number, number, number]
  rotY: number
}): THREE.BufferGeometry | null {
  let s = opts.seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  const parts: THREE.BufferGeometry[] = []
  let u = opts.u0
  let n = 0
  while (u < opts.u1) {
    const w = 0.3 * (0.86 + rand() * 0.28)
    const gap = 0.01 + rand() * 0.022
    if (u + w > opts.u1) break
    if (rand() > 0.03) {
      const g = plankUVs(chamferedBox(w, opts.height, 0.045), opts.height, n * 31 + 17)
      g.rotateY(opts.rotY)
      const [px, py, pz] = opts.place(u + w / 2, opts.height / 2)
      g.translate(px, py, pz)
      parts.push(g)
    }
    u += w + gap
    n++
  }
  if (!parts.length) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  return merged
}

function useBakeryShell() {
  return useMemo(() => {
    const walls: THREE.BufferGeometry[] = []

    // South wall, and the north wall with the window opening left in it.
    const south = boardWall({
      seed: 511,
      u0: B.z0,
      u1: B.z1,
      height: B.ceiling,
      place: (u, y) => [B.x0, y, u],
      rotY: Math.PI / 2,
    })
    if (south) walls.push(south)

    // North wall in two runs, leaving a window between z 7.3 and 8.5.
    for (const [z0, z1] of [
      [B.z0, 7.3],
      [8.5, B.z1],
    ] as const) {
      const w = boardWall({
        seed: 622 + z0,
        u0: z0,
        u1: z1,
        height: B.ceiling,
        place: (u, y) => [B.x1, y, u],
        rotY: Math.PI / 2,
      })
      if (w) walls.push(w)
    }
    /*
     * The band under the window and the band over it.
     *
     * boardWall always builds from y = 0 up to `height`, so a band is built at
     * its own height and then lifted into place. Trying to express the offset
     * through `place` instead puts the boards at half the intended height,
     * because the callback receives the centre and not the base.
     */
    for (const [y0, y1] of [
      [0, 0.75],
      [2.55, B.ceiling],
    ] as const) {
      const band = boardWall({
        seed: 733 + y0 * 100,
        u0: 7.3,
        u1: 8.5,
        height: y1 - y0,
        place: (u, y) => [B.x1, y, u],
        rotY: Math.PI / 2,
      })
      if (band) {
        band.translate(0, y0, 0)
        walls.push(band)
      }
    }

    // Far end.
    const end = boardWall({
      seed: 844,
      u0: B.x0,
      u1: B.x1,
      height: B.ceiling,
      place: (u, y) => [u, y, B.z1],
      rotY: 0,
    })
    if (end) walls.push(end)

    const shell = walls.length ? mergeGeometries(walls, false) : null
    walls.forEach((g) => g.dispose())

    /*
     * Ceiling boards, running across. Low and close, which is the whole point
     * of the room: you feel the lid over you the moment you step through.
     */
    const ceilParts: THREE.BufferGeometry[] = []
    let z = B.z0
    let n = 0
    while (z < B.z1) {
      const w = 0.32
      const g = plankUVs(chamferedBox(B.x1 - B.x0, 0.06, w), B.x1 - B.x0, n * 31 + 3)
      g.translate((B.x0 + B.x1) / 2, B.ceiling, z + w / 2)
      ceilParts.push(g)
      z += w + 0.008
      n++
    }
    const ceiling = mergeGeometries(ceilParts, false)
    ceilParts.forEach((g) => g.dispose())

    // Floor: boards again, a step down from the barn is not worth the collision
    // complexity, so it sits flush.
    const floorParts: THREE.BufferGeometry[] = []
    let x = B.x0
    let fn = 0
    while (x < B.x1) {
      const w = 0.2
      const g = plankUVs(chamferedBox(w, B.z1 - B.z0, 0.06), B.z1 - B.z0, fn * 31 + 9)
      g.rotateX(Math.PI / 2)
      g.translate(x + w / 2, 0.03, (B.z0 + B.z1) / 2)
      floorParts.push(g)
      x += w + 0.005
      fn++
    }
    const floor = mergeGeometries(floorParts, false)
    floorParts.forEach((g) => g.dispose())

    return { shell, ceiling, floor }
  }, [])
}

/**
 * The oven door, breathing.
 *
 * Deliberately dim. The first pass ran the door emissive and its point light at
 * roughly three times this, on the reasoning that an oven is hot — and the
 * whole room came back lurid red, the brick included, with the door a
 * featureless white slab. A real oven door at night is a *small* bright thing
 * in a dark room, and almost all of its effect is the warm bounce it puts on
 * everything nearby rather than its own brightness. Turning it down is what
 * made it read as fire rather than as a screen.
 */
function OvenGlow({ light }: { light: SceneLight }) {
  const lamp = useRef<THREE.PointLight>(null)
  const door = useRef<THREE.Mesh>(null)

  /*
   * Firebrick, off the same generator as the counter slab.
   *
   * It was a flat colour with no maps at all, which at this distance made it
   * the most obviously fake object left in the frame — a perfectly smooth
   * two-metre slab catching one even highlight across its whole face. The
   * soapstone generator already produces a mottled albedo with normal and
   * roughness derived from it, and firebrick and soapstone are the same
   * problem: a dense, matte, unevenly worn stone. Only the tint differs.
   */
  const brick = useSoapstone('#8a6a58', [0.72, 0.96])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    /*
     * Two frequencies, per the handoff. One sine reads as a pulse — a machine
     * blinking. Two that do not divide into each other never repeat inside the
     * time anyone watches, and that is what fire looks like.
     */
    const f = 1 + Math.sin(t * 5.3) * 0.09 + Math.sin(t * 1.7) * 0.06
    if (lamp.current) lamp.current.intensity = (0.45 + light.lampIntensity * 0.2) * f
    if (door.current) {
      ;(door.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 * f
    }
  })

  return (
    <group position={[3.4, 0, 8.95]}>
      {/* Deck oven: a brick box with a cast door. */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow material={brick}>
        <boxGeometry args={[1.5, 1.7, 0.9]} />
      </mesh>
      <mesh position={[0, 1.02, -0.47]} castShadow>
        <boxGeometry args={[0.86, 0.52, 0.06]} />
        <meshStandardMaterial color="#1a1614" roughness={0.55} metalness={0.6} />
      </mesh>
      {/*
        * Turned to face the room. A PlaneGeometry faces +Z, and the bakery is
        * entered from -Z, so the unrotated door showed the camera its back and
        * the oven read as a black hole in a red box — which looked like the
        * emissive was broken rather than pointing the wrong way.
        */}
      <mesh ref={door} position={[0, 1.02, -0.51]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.74, 0.4]} />
        <meshStandardMaterial
          color="#40160a"
          emissive={new THREE.Color('#ff8330')}
          emissiveIntensity={1.5}
        />
      </mesh>
      <pointLight
        ref={lamp}
        position={[0, 1.02, -1.0]}
        color="#ff9d5c"
        intensity={0.5}
        distance={3.6}
        decay={2}
        castShadow={false}
      />
      {/* Flue up through the ceiling. */}
      <mesh position={[0, 2.2, 0.2]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.4, 12]} />
        <meshStandardMaterial color="#232120" roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  )
}

/**
 * Why this room needed its own bulb colour and a window.
 *
 * Measured off the far wall at dusk, the bakery came back rgb(69, 23, 5) — the
 * green channel a third of red, blue at 2%, which is 93% saturated and about
 * as close to monochrome as a colour image gets. The barn's own wall, three
 * metres away through the hatch, measures rgb(103, 84, 64): 38%.
 *
 * Three passes at this blamed the wall tint, the oven, and the grade, and each
 * one helped a little because each was slightly true. None was the cause. The
 * cause is that the bakery is a closed box lit by exactly one colour. The barn
 * gets daylight through the door and three hundred gaps, so its orange bulbs
 * land on top of a blue-white fill and the two average out to warm brown. Seal
 * the room, take the daylight away, and the same bulb multiplied by the same
 * brown planks has nothing to lift the blue channel with — every pixel ends up
 * on one line through colour space, and a room lit by one colour reads as
 * tinted rather than lit, no matter what you do to the tint.
 *
 * So: two illuminants of different colours, which is what an interior needs.
 * The pendant is a warm white rather than the barn's deep orange — the barn can
 * carry #ffb257 because daylight balances it and this room cannot — and the
 * window gets a cool fill that rides the daylight and dies at night, when the
 * oven takes over as the second colour instead.
 */
const PENDANT = new THREE.Color('#ffd9b4')

/**
 * North sky, and deliberately not the scene's ambient colour.
 *
 * Reaching for `light.ambientColor` is the obvious move and it does nothing
 * here: at golden hour the scene's ambient *is* warm, so the "cool fill" came
 * in the same colour as the bulb and the room stayed on one line. This window
 * faces +X, which in this scene is north — the door faces west — and a north
 * window sees blue sky at every hour including sunset, when the warm light is
 * all behind the building. So the fill is fixed and cold, and only its
 * brightness rides the day.
 */
const NORTH_SKY = new THREE.Color('#8ba6c6')

export function Bakery({ light, bulbsOn }: { light: SceneLight; bulbsOn: boolean }) {
  const { shell, ceiling, floor } = useBakeryShell()
  const maps = useWoodMaps(GRAIN.siding)
  const furnitureMaps = useWoodMaps(GRAIN.furniture)

  /*
   * Limewashed, which is both the fix and the truth.
   *
   * Every bakery that has ever passed an inspection has white walls, because
   * limewash is cheap, it is mildly antiseptic, and it throws the light around
   * a room with one small window. It also solves the measurement: bare planks
   * are about 1 : 0.61 : 0.34 in their own albedo, so under any light at all a
   * third of the saturation problem is the timber itself, and no lamp colour
   * fixes that. Washing the boards lifts every channel and lets the grain read
   * through as texture instead of as colour.
   */
  const boards = useWoodMaterial(maps, {
    tint: '#efe9dc',
    roughness: 0.98,
    normalScale: 1.2,
    side: THREE.DoubleSide,
  })
  const bench = useWoodMaterial(furnitureMaps, { tint: '#c8ab7c', roughness: 0.62 })
  const rack = useWoodMaterial(furnitureMaps, { tint: '#6b563c', roughness: 0.85 })

  const crust = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#9c7440', roughness: 0.82, envMapIntensity: 0.4 }),
    [],
  )
  const linen = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8f8676', roughness: 1 }),
    [],
  )

  /*
   * The pendant, and not the oven, is what lights this room.
   *
   * The first pass had it the other way round and the bakery came back a solid
   * red box: an oven throwing enough light to read by paints every plank the
   * colour of its own door. A working bakery has a bulb over the bench and a
   * warm slot at the far end.
   */
  const bulb = bulbsOn ? Math.max(light.lampIntensity, 1.05) : 0

  return (
    <group>
      {shell && <mesh geometry={shell} material={boards} castShadow receiveShadow />}
      <mesh geometry={ceiling} material={boards} castShadow receiveShadow />
      <mesh geometry={floor} material={boards} receiveShadow />

      <OvenGlow light={light} />

      {/*
       * Daylight through the window, as a second colour rather than as a
       * source of brightness. It sits just outside the opening at x 4.4,
       * z 7.3-8.5, and carries the sky's own colour, so the side of the room
       * facing it goes cool and the side facing the pendant stays warm. That
       * difference is the whole point — it is what stops every surface sitting
       * on one line through colour space.
       *
       * It rides envIntensity, so it fades out with the day and the oven
       * becomes the second colour instead after dark.
       */}
      <pointLight
        position={[4.15, 1.75, 7.9]}
        color={NORTH_SKY}
        intensity={3.4 + light.envIntensity * 16}
        distance={9}
        decay={2}
        castShadow={false}
      />

      {/* Work bench down the middle, with dough proving under linen. */}
      <group position={[1.4, 0, 7.8]}>
        <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.08, 1.5]} />
          <primitive object={bench} attach="material" />
        </mesh>
        {[-0.65, 0.65].map((x) =>
          [-0.65, 0.65].map((z) => (
            <mesh key={`${x},${z}`} position={[x, 0.44, z]} castShadow>
              <boxGeometry args={[0.09, 0.88, 0.09]} />
              <primitive object={rack} attach="material" />
            </mesh>
          )),
        )}
        {[
          [-0.35, -0.3],
          [0.1, 0.25],
          [0.42, -0.35],
        ].map(([x, z], i) => (
          <mesh
            key={i}
            position={[x, 0.962, z]}
            rotation={[0, i * 0.8, 0]}
            scale={[1, 0.62, 1]}
            castShadow
          >
            <sphereGeometry args={[0.082, 18, 12]} />
            <primitive object={linen} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Three racks of loaves against the south wall. */}
      {[6.9, 7.9, 8.9].map((z, r) => (
        <group key={z} position={[0.62, 0, z]}>
          {[0.55, 1.05, 1.55].map((y) => (
            <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.5, 0.04, 0.85]} />
              <primitive object={rack} attach="material" />
            </mesh>
          ))}
          {[0.55, 1.05, 1.55].map((y) =>
            [-0.26, 0, 0.26].map((z2, i) => (
              <mesh
                key={`${y},${z2}`}
                position={[0, y + 0.08, z2]}
                rotation={[0, (r + i) * 0.5, 0]}
                castShadow
              >
                <capsuleGeometry args={[0.043, 0.12, 4, 10]} />
                <primitive object={crust} attach="material" />
              </mesh>
            )),
          )}
        </group>
      ))}

      {/* Its own pendant, low over the bench. */}
      <group position={[1.4, 0, 7.8]}>
        <mesh position={[0, 2.45, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.55, 6]} />
          <meshStandardMaterial color="#1a1410" roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.16, 0]} castShadow>
          <coneGeometry args={[0.17, 0.16, 18, 1, true]} />
          <meshStandardMaterial color="#3d3128" roughness={0.5} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 2.08, 0]}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshStandardMaterial
            color="#fff0d2"
            emissive={PENDANT}
            emissiveIntensity={bulb * 3.2}
            roughness={0.25}
          />
        </mesh>
        <pointLight
          position={[0, 2.05, 0]}
          color={PENDANT}
          intensity={bulb * 10}
          distance={8}
          decay={2}
          castShadow={false}
        />
      </group>
    </group>
  )
}
