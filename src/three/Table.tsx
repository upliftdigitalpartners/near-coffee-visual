import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { GRAIN, boardUVs, sweptUVs, turnedUVs } from './wood'

/**
 * A tripod pedestal table.
 *
 * Three cylinders stood in for this: a disc, a tapered post, and another disc
 * on the floor. It is the largest object in most frames — at the seated
 * camera the near edge crosses the entire bottom of the picture — so the
 * cylinder tax was being paid at the biggest possible size.
 *
 * **The edge is the whole top.** A cylinder's rim is a 60mm vertical band with
 * a hard corner top and bottom, and a hard corner is a black line: it never
 * catches light from anywhere. A real table edge is rounded or moulded, so it
 * carries a bright line all the way round where it turns toward the window,
 * and that line is what the eye reads as "a solid slab of timber" rather than
 * "a disc". Eight points in a profile buy it.
 *
 * **A pedestal is turned.** Vase swell low down, a waist, a collar under the
 * top. A cone has one continuous gradient down its length and no features for
 * a highlight to sit on, which is why the old post read as a drainpipe.
 *
 * **The base disc was wrong twice.** It was a 40mm slab of wood lying flat on
 * the floor, which no table has, and it killed the shadow gap underneath. A
 * tripod's three splayed feet put light and floorboards through the middle of
 * the table, and that gap does more for the sense of a real room than the
 * table itself does.
 *
 * The top surface stays at exactly 0.77, because the crockery, the notebook
 * and every seat's tray coordinate are measured off it.
 */

/** Top of the table, in metres. Everything placed on one is measured from here. */
export const TOP_Y = 0.77
const THICK = 0.058
/** Height on the column where the legs are let in. */
const LEG_Y = 0.235

/**
 * The top, as a slab with a bullnose edge.
 *
 * Widest at mid-thickness rather than at the corners, which is what a
 * round-over bit actually leaves, and is why the highlight sits in a band
 * rather than on an edge.
 */
function topProfile(r: number): THREE.Vector2[] {
  const u = TOP_Y - THICK
  const p: [number, number][] = [
    // Underside, in from the edge.
    [0.0, u],
    [r - 0.022, u],
    [r - 0.008, u + 0.006],
    // Round the edge.
    [r - 0.001, u + 0.017],
    [r + 0.002, THICK / 2 + u],
    [r - 0.002, TOP_Y - 0.016],
    [r - 0.011, TOP_Y - 0.004],
    [r - 0.02, TOP_Y],
    [0.0, TOP_Y],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/** The column: vase, waist, collar, and the cleat the top screws onto. */
function columnProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.16],
    [0.098, 0.16],
    [0.102, 0.185],
    [0.096, 0.215],
    // The vase, swelling.
    [0.108, 0.26],
    [0.11, 0.32],
    [0.098, 0.4],
    [0.08, 0.48],
    // Waist.
    [0.066, 0.545],
    [0.062, 0.585],
    [0.066, 0.612],
    // Collar, then out into the cleat under the top.
    [0.084, 0.638],
    [0.081, 0.66],
    [0.112, 0.686],
    [0.112, TOP_Y - THICK],
    [0.0, TOP_Y - THICK],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/**
 * A swept tube whose radius changes along its length.
 *
 * `TubeGeometry` can only do a constant radius, which is the same drainpipe
 * problem as a cylinder — nothing for a highlight to break on. Its vertex
 * normals point straight out from the centreline, though, so pushing every
 * vertex of a ring along its own normal changes that ring's radius exactly,
 * without disturbing where it sits on the curve. Rings are laid out in order,
 * `radial + 1` vertices each, so the ring index is just the row.
 */
function taperedTube(
  curve: THREE.Curve<THREE.Vector3>,
  tubular: number,
  radial: number,
  base: number,
  radiusAt: (t: number) => number,
): THREE.BufferGeometry {
  const g = new THREE.TubeGeometry(curve, tubular, base, radial, false)
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const per = radial + 1
  for (let i = 0; i <= tubular; i++) {
    const d = radiusAt(i / tubular) - base
    for (let j = 0; j < per; j++) {
      const k = i * per + j
      pos.setXYZ(
        k,
        pos.getX(k) + nor.getX(k) * d,
        pos.getY(k) + nor.getY(k) * d,
        pos.getZ(k) + nor.getZ(k) * d,
      )
    }
  }
  g.computeVertexNormals()
  return g
}

/**
 * One leg, swept.
 *
 * A tripod leg is not a stick at an angle. It leaves the column heading down
 * and outward, then flattens as it reaches the floor so the last few
 * centimetres are nearly horizontal and the toe lands flat. Drawn in the XY
 * plane with X running outward, then swung to its bearing.
 */
function legGeometry(rFoot: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.07, LEG_Y + 0.07, 0),
    new THREE.Vector3(0.13, LEG_Y - 0.05, 0),
    new THREE.Vector3(rFoot * 0.55, 0.105, 0),
    new THREE.Vector3(rFoot * 0.82, 0.055, 0),
    new THREE.Vector3(rFoot, 0.038, 0),
  ])
  // Thick where it is let into the column, thin at the toe, with a little
  // swell through the knee where the bend is.
  const g = taperedTube(curve, 26, 10, 0.05, (t) =>
    0.052 - 0.024 * t + 0.006 * Math.sin(t * Math.PI),
  )
  // Grain follows the sweep, not the way round it. See wood.ts.
  return sweptUVs(g, GRAIN.furniture, curve.getLength(), 4)
}

/** The pad the toe stands on. */
function padProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.0],
    [0.044, 0.0],
    [0.046, 0.012],
    [0.04, 0.03],
    [0.028, 0.042],
    [0.0, 0.045],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

export function Table({
  position,
  radius,
  rotation = 0,
  seed = 1,
  top,
  frame,
  children,
}: {
  position: [number, number, number]
  radius: number
  rotation?: number
  /** Which boards this one was glued up from. Two tables should not match. */
  seed?: number
  top: THREE.Material
  frame: THREE.Material
  children?: ReactNode
}) {
  const geo = useMemo(() => {
    /*
     * Feet reach roughly two thirds of the way out under the top. Further and
     * anyone sitting kicks them; nearer and the table looks like it is about
     * to go over when someone leans on the edge.
     */
    const rFoot = radius * 0.66
    return {
      // Box-projected, or the grain wraps into a bullseye. See wood.ts.
      top: boardUVs(new THREE.LatheGeometry(topProfile(radius), 44), GRAIN.furniture, seed),
      column: turnedUVs(new THREE.LatheGeometry(columnProfile(), 28), GRAIN.furniture, seed + 1),
      leg: legGeometry(rFoot),
      pad: turnedUVs(new THREE.LatheGeometry(padProfile(), 14), GRAIN.furniture, 2),
      rFoot,
    }
  }, [radius, seed])

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.top} material={top} castShadow receiveShadow />
      <mesh geometry={geo.column} material={frame} castShadow receiveShadow />
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a, i) => (
        <group key={i} rotation={[0, -a, 0]}>
          <mesh geometry={geo.leg} material={frame} castShadow receiveShadow />
          <mesh
            geometry={geo.pad}
            material={frame}
            position={[geo.rFoot, 0, 0]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
      {children}
    </group>
  )
}
