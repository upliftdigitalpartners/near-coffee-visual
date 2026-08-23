import { useMemo } from 'react'
import * as THREE from 'three'
import { GRAIN, boardUVs, turnedUVs } from './wood'

/**
 * A turned three-legged stool.
 *
 * What was here: a squat cylinder for a seat and three thin cylinders standing
 * straight down under it, all of them vertical, all of them the same diameter
 * top to bottom. Two things were wrong with that, and only one of them is
 * about detail.
 *
 * **Legs splay.** This is the important one. A stool with vertical legs falls
 * over the moment anyone leans, so no stool has ever been built that way — the
 * feet always stand wider than the seat. It is a silhouette fact, readable from
 * across the room, and it is why the old stools looked like side tables. Here
 * the feet sit at 195mm and the leg tops at 75mm, which is a real 16 degrees.
 *
 * **A leg is turned, not extruded.** A shop stool is spindle work: the leg
 * swells above the foot, waists in the middle, and swells again into a collar
 * under the seat. That changing radius is what gives a leg its band of
 * highlight, and a constant-radius cylinder has nowhere for the highlight to
 * go, so it reads flat however good the wood map is.
 *
 * The seat is dished — 16mm hollowed at the centre, over a rounded edge. That
 * costs six points in a profile and is the difference between a seat and a
 * disc, because the dish catches a soft gradient across the top instead of one
 * flat tone.
 *
 * Geometry is memoised per stool but the profiles are constant, so all of them
 * across the room share the three buffers.
 */

/** Top of the seat, in metres. Tables here stand at 0.77. */
const SEAT_Y = 0.46
/** Underside of the seat: where the legs stop. */
const SEAT_UNDER = 0.41
const R_TOP = 0.075
const R_FOOT = 0.195
const STRETCHER_Y = 0.15

function seatProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    // Underside, flat, then out to the edge.
    [0.0, -0.05],
    [0.14, -0.05],
    [0.165, -0.043],
    // The rounded edge, which is the part anyone's hand touches.
    [0.176, -0.03],
    [0.178, -0.014],
    [0.173, -0.002],
    // Back across the top, dishing toward the centre.
    [0.15, -0.005],
    [0.115, -0.01],
    [0.075, -0.014],
    [0.035, -0.0165],
    [0.0, -0.017],
  ]
  return p.map(([r, y]) => new THREE.Vector2(r, y))
}

/**
 * One leg, as a spindle.
 *
 * Written against a normalised height so the same profile stretches to whatever
 * length the splay works out to; the swells stay in proportion rather than
 * bunching at one end.
 */
function legProfile(len: number): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.0],
    [0.021, 0.0],
    // Foot, and the swell just above it.
    [0.023, 0.02],
    [0.027, 0.07],
    [0.024, 0.14],
    // Waist.
    [0.017, 0.34],
    [0.0165, 0.52],
    [0.019, 0.66],
    // Collar under the seat.
    [0.026, 0.84],
    [0.023, 0.9],
    [0.021, 0.96],
    [0.0, 1.0],
  ]
  return p.map(([r, t]) => new THREE.Vector2(r, t * len))
}

/** A stretcher between two legs: a spindle with its bulge in the middle. */
function stretcherProfile(len: number): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.0],
    [0.014, 0.0],
    [0.013, 0.12],
    [0.017, 0.3],
    [0.017, 0.7],
    [0.013, 0.88],
    [0.014, 1.0],
    [0.0, 1.0],
  ]
  return p.map(([r, t]) => new THREE.Vector2(r, t * len))
}

export function Stool({
  position,
  rotation = 0,
  seat,
  leg,
}: {
  position: [number, number, number]
  /** Turned so that three identical stools around a table are not identical. */
  rotation?: number
  seat: THREE.Material
  leg: THREE.Material
}) {
  const geo = useMemo(() => {
    const rise = SEAT_UNDER
    const run = R_FOOT - R_TOP
    const len = Math.hypot(rise, run)
    /*
     * The leg leans inward as it rises, so the tilt is measured off vertical
     * in the plane containing the leg and the stool's axis. Rotating about Z
     * by this angle moves local +Y toward -X, which is the inward direction
     * once the whole leg group has been swung round to its own bearing.
     */
    const tilt = Math.asin(run / len)

    /*
     * Where the legs actually are at stretcher height — not at the foot. The
     * legs are leaning, so a stretcher cut to the spread of the feet would
     * stick out past them by 45mm at each end.
     */
    const rStretch = R_FOOT - run * (STRETCHER_Y / SEAT_UNDER)
    // Straight-line distance between two legs 120 degrees apart, there.
    const chord = 2 * rStretch * Math.sin(Math.PI / 3)

    return {
      // Box-projected: a lathe's own UVs ring a flat seat. See wood.ts.
      seat: boardUVs(new THREE.LatheGeometry(seatProfile(), 36), GRAIN.furniture, 7),
      leg: turnedUVs(new THREE.LatheGeometry(legProfile(len), 14), GRAIN.furniture, 3),
      stretcher: turnedUVs(new THREE.LatheGeometry(stretcherProfile(chord), 10), GRAIN.furniture, 6),
      tilt,
      rStretch,
    }
  }, [])

  const bearings = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={geo.seat} material={seat} position={[0, SEAT_Y, 0]} castShadow receiveShadow />

      {bearings.map((a, i) => (
        <group key={i} rotation={[0, -a, 0]}>
          <mesh
            geometry={geo.leg}
            material={leg}
            position={[R_FOOT, 0, 0]}
            rotation={[0, 0, geo.tilt]}
            castShadow
            receiveShadow
          />
        </group>
      ))}

      {/*
       * Three stretchers, forming a triangle low down between the legs. They
       * are structurally why a splayed stool survives being sat on sideways,
       * and visually they close the gap under the seat so the legs stop
       * reading as three unrelated sticks.
       */}
      {bearings.map((a, i) => {
        const b = a + (Math.PI * 2) / 3
        const from = new THREE.Vector3(
          Math.cos(a) * geo.rStretch,
          STRETCHER_Y,
          Math.sin(a) * geo.rStretch,
        )
        const to = new THREE.Vector3(
          Math.cos(b) * geo.rStretch,
          STRETCHER_Y,
          Math.sin(b) * geo.rStretch,
        )
        /*
         * The spindle is lathed along +Y from its own origin, so it is laid
         * along the chord by rotating +Y onto the direction between the two
         * legs and hanging it off the first of them. Composing Euler angles by
         * hand for this is the kind of thing that comes out mirrored.
         */
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          to.clone().sub(from).normalize(),
        )
        return (
          <mesh
            key={i}
            geometry={geo.stretcher}
            material={leg}
            position={from}
            quaternion={q}
            castShadow
          />
        )
      })}
    </group>
  )
}
