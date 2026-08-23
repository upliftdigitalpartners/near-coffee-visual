import { useMemo } from 'react'
import * as THREE from 'three'
import { useStoneware } from './surfaces'

/**
 * A cup, a saucer, and the handle between them.
 *
 * The cup was three stacked cylinders and a torus, and it is the object a
 * visitor looks at from closest range in the entire building — it sits about a
 * metre from the seated camera at your own table, which is the opening frame.
 * Everything wrong with it was therefore magnified more than anything else in
 * the scene.
 *
 * Three things a cylinder cannot do, in order of how much they cost:
 *
 * **A rim has thickness.** This is the whole thing. A cylinder's wall is
 * infinitely thin, so the edge of the cup is a hard line with the inside
 * visible right up against the outside. A real cup is 3-4mm of clay at the lip,
 * and the tiny band of curvature there catches its own highlight all the way
 * round. It is the single most recognisable feature of thrown crockery and the
 * reason a cylinder reads as a paper cup.
 *
 * **A cup has a foot.** It does not sit flat on the table; it stands on a ring,
 * with a shadow gap under the middle. Two millimetres of lift, and the object
 * stops being stuck to the surface.
 *
 * **A handle is swept, not a torus.** A torus section has constant radius and
 * lies in one plane. A real handle is pulled — thicker where it joins the body,
 * thinner at the bottom of the loop — and a tube swept along a curve gives that
 * for the same cost.
 *
 * The whole profile runs up the outside, over the lip and back down the inside
 * as one continuous line, so the lathe closes the wall by itself.
 */

function cupProfile(scale: number): THREE.Vector2[] {
  const p: [number, number][] = [
    // Foot ring: stands the cup off the saucer.
    [0.0, 0.0],
    [0.019, 0.0],
    [0.021, 0.003],
    [0.026, 0.007],
    [0.023, 0.011],
    // Outside wall, swelling then flaring to the lip.
    [0.028, 0.016],
    [0.034, 0.026],
    [0.04, 0.04],
    [0.044, 0.054],
    [0.0465, 0.064],
    // Over the lip. These four points are the cup.
    [0.047, 0.0665],
    [0.0455, 0.068],
    [0.0435, 0.0665],
    // Back down the inside.
    [0.041, 0.06],
    [0.036, 0.046],
    [0.03, 0.03],
    [0.024, 0.018],
    [0.018, 0.014],
    [0.0, 0.0125],
  ]
  return p.map(([r, y]) => new THREE.Vector2(r * scale, y * scale))
}

function saucerProfile(scale: number): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.006],
    [0.03, 0.006],
    // The well the foot ring sits in.
    [0.033, 0.0065],
    [0.036, 0.009],
    [0.052, 0.012],
    [0.067, 0.016],
    [0.0715, 0.019],
    // Over the rim and back underneath.
    [0.073, 0.0175],
    [0.0705, 0.0135],
    [0.05, 0.0075],
    [0.032, 0.004],
    [0.028, 0.0],
    [0.0, 0.0],
  ]
  return p.map(([r, y]) => new THREE.Vector2(r * scale, y * scale))
}

/**
 * The handle, swept along a curve.
 *
 * Drawn in the cup's XY plane and pushed out to the wall. The radius tapers
 * along it via a scaled tube: thick where it meets the body, thinner round the
 * bottom of the loop, which is how a pulled handle actually is.
 */
function handleGeometry(scale: number): THREE.BufferGeometry {
  const s = scale
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.042 * s, 0.056 * s, 0),
    new THREE.Vector3(0.068 * s, 0.052 * s, 0),
    new THREE.Vector3(0.079 * s, 0.036 * s, 0),
    new THREE.Vector3(0.072 * s, 0.019 * s, 0),
    new THREE.Vector3(0.046 * s, 0.014 * s, 0),
  ])
  return new THREE.TubeGeometry(curve, 28, 0.0055 * s, 10, false)
}

export function Cup({
  scale = 1,
  coffee = true,
  position = [0, 0, 0],
  rotation = 0,
}: {
  scale?: number
  /** A cup on a shelf is empty; a cup on a table is not. */
  coffee?: boolean
  position?: [number, number, number]
  rotation?: number
}) {
  const china = useStoneware()
  const geo = useMemo(
    () => ({
      cup: new THREE.LatheGeometry(cupProfile(scale), 40),
      handle: handleGeometry(scale),
    }),
    [scale],
  )

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.cup} material={china} castShadow receiveShadow />
      <mesh geometry={geo.handle} material={china} castShadow />
      {coffee && (
        /*
         * Set 6mm below the lip, not level with it. Coffee at the brim
         * z-fights the rim it is supposed to sit inside, and a cup filled to
         * the very top is not something anyone would carry.
         */
        <mesh position={[0, 0.0605 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.0405 * scale, 32]} />
          <meshStandardMaterial
            color="#38200f"
            roughness={0.16}
            metalness={0.02}
          />
        </mesh>
      )}
    </group>
  )
}

export function Saucer({
  scale = 1,
  position = [0, 0, 0],
}: {
  scale?: number
  position?: [number, number, number]
}) {
  const china = useStoneware()
  const geo = useMemo(() => new THREE.LatheGeometry(saucerProfile(scale), 40), [scale])
  return <mesh geometry={geo} material={china} position={position} castShadow receiveShadow />
}
