import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chamferedBox, GRAIN, plankUVs, useWoodMaps, useWoodMaterial } from './wood'
import { BARN } from '../scene/barn'
import {
  FLOOR_UV,
  ROOF_UV,
  WALL_UV,
  useFloorMacro,
  useRoofMacro,
  useWallMacro,
  withMacro,
} from './macro'

/**
 * The barn.
 *
 * The single most important decision in this file is that the siding is built
 * from individual boards with real gaps between them, rather than a wall with
 * a wood texture on it. Gaps mean the sun genuinely gets through and lays
 * stripes across the floor and the counter, and no amount of texturing
 * reproduces that. It is the reason to use 3D here at all.
 *
 * Dimensions live in scene/barn.ts, and are re-exported below because half
 * the scene measures itself against them.
 */

export { BARN } from '../scene/barn'

const BOARD_W = 0.30
const BOARD_T = 0.045

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * A board, with its UVs measured in metres and started at a random point in
 * the texture. Same material everywhere, no two planks alike.
 */
function board(w: number, h: number, d: number, seed: number): THREE.BufferGeometry {
  return plankUVs(chamferedBox(w, h, d), h, seed * 2654435761)
}

type Span = { y0: number; y1: number }

/** Solid spans of a vertical board at a given position, given an opening. */
function spans(
  wallTop: number,
  overlapsOpening: boolean,
  opening?: { y0: number; y1: number },
): Span[] {
  if (!overlapsOpening || !opening) return [{ y0: 0, y1: wallTop }]
  const out: Span[] = []
  if (opening.y0 > 0.02) out.push({ y0: 0, y1: opening.y0 })
  if (opening.y1 < wallTop - 0.02) out.push({ y0: opening.y1, y1: wallTop })
  return out
}

type BoardPlacement = {
  geom: THREE.BufferGeometry
  pos: [number, number, number]
  rotY: number
  variant: number
}

/**
 * Lay vertical boards along a horizontal run.
 *
 * `heightAt` lets the gable ends step up to the ridge, and `opening` punches
 * the door or window through. Gaps between boards vary, a few boards are
 * missing outright, and most seams get a batten — the ones that do not are
 * where the light gets in.
 */
function sideOfBoards(opts: {
  seed: number
  /** Distance along the wall, start and end. */
  u0: number
  u1: number
  /** Wall height at a given u. */
  heightAt: (u: number) => number
  opening?: { u0: number; u1: number; y0: number; y1: number }
  /** Maps a distance-along value to a world position. */
  place: (u: number, y: number) => [number, number, number]
  rotY: number
}): BoardPlacement[] {
  const rand = rng(opts.seed)
  const out: BoardPlacement[] = []
  let u = opts.u0
  let n = 0

  while (u < opts.u1) {
    const gap = 0.012 + rand() * 0.032
    const w = BOARD_W * (0.86 + rand() * 0.28)
    const centre = u + w / 2
    if (centre > opts.u1) break

    const missing = rand() < 0.035
    if (!missing) {
      const top = opts.heightAt(centre)
      const overlaps =
        !!opts.opening && centre > opts.opening.u0 - w / 2 && centre < opts.opening.u1 + w / 2
      for (const s of spans(top, overlaps, opts.opening)) {
        const h = s.y1 - s.y0
        if (h < 0.08) continue
        const variant = n * 7 + 13
        out.push({
          geom: board(w, h, BOARD_T, variant),
          pos: opts.place(centre, s.y0 + h / 2),
          rotY: opts.rotY,
          variant,
        })
      }
    }

    // Batten over the seam, most of the time.
    if (rand() < 0.62 && u > opts.u0) {
      const top = opts.heightAt(u)
      const overlaps = !!opts.opening && u > opts.opening.u0 && u < opts.opening.u1
      for (const s of spans(top, overlaps, opts.opening)) {
        const h = s.y1 - s.y0
        if (h < 0.4) continue
        const variant = n * 7 + 101
        out.push({
          geom: board(0.085, h, BOARD_T * 1.5, variant),
          pos: opts.place(u, s.y0 + h / 2),
          rotY: opts.rotY,
          variant,
        })
      }
    }

    u += w + gap
    n++
  }
  return out
}

/** Merge everything sharing a texture column into one draw call. */
function mergeByVariant(placements: BoardPlacement[]): THREE.BufferGeometry | null {
  const geoms: THREE.BufferGeometry[] = []
  for (const p of placements) {
    const g = p.geom.clone()
    g.rotateY(p.rotY)
    g.translate(p.pos[0], p.pos[1], p.pos[2])
    geoms.push(g)
    p.geom.dispose()
  }
  if (!geoms.length) return null
  const merged = mergeGeometries(geoms, false)
  geoms.forEach((g) => g.dispose())
  return merged
}

function useBarnGeometry() {
  return useMemo(() => {
    const { halfWidth: HW, frontZ, backZ, eaveY, ridgeY, door, sideWindow } = BARN

    /** Gable ends rise to the ridge in the middle. */
    const gableHeight = (x: number) =>
      eaveY + (ridgeY - eaveY) * Math.max(0, 1 - Math.abs(x) / HW)

    const all: BoardPlacement[] = []

    // Front (west) gable end, with the sliding door open.
    all.push(
      ...sideOfBoards({
        seed: 101,
        u0: -HW,
        u1: HW,
        heightAt: gableHeight,
        opening: { u0: door.x0, u1: door.x1, y0: 0, y1: door.y1 },
        place: (u, y) => [u, y, frontZ],
        rotY: 0,
      }),
    )

    // Back (east) gable end, with the doorway through to the bakery.
    all.push(
      ...sideOfBoards({
        seed: 202,
        u0: -HW,
        u1: HW,
        heightAt: gableHeight,
        opening: { u0: BARN.hatch.x0, u1: BARN.hatch.x1, y0: 0, y1: BARN.hatch.y1 },
        place: (u, y) => [u, y, backZ],
        rotY: 0,
      }),
    )

    // South wall (-X), with the small window.
    all.push(
      ...sideOfBoards({
        seed: 303,
        u0: frontZ,
        u1: backZ,
        heightAt: () => eaveY,
        opening: { u0: sideWindow.z0, u1: sideWindow.z1, y0: sideWindow.y0, y1: sideWindow.y1 },
        place: (u, y) => [-HW, y, u],
        rotY: Math.PI / 2,
      }),
    )

    // North wall (+X).
    all.push(
      ...sideOfBoards({
        seed: 404,
        u0: frontZ,
        u1: backZ,
        heightAt: () => eaveY,
        place: (u, y) => [HW, y, u],
        rotY: Math.PI / 2,
      }),
    )

    const walls = mergeByVariant(all)

    // Roof: sheathing boards running up the slope, with gaps of their own.
    const roofRand = rng(707)
    const roofBoards: THREE.BufferGeometry[] = []
    const slopeLen = Math.hypot(HW, ridgeY - eaveY)
    const pitch = Math.atan2(ridgeY - eaveY, HW)
    for (const side of [-1, 1]) {
      let z = frontZ
      let n = 0
      while (z < backZ) {
        const w = 0.34 * (0.85 + roofRand() * 0.3)
        const gap = 0.01 + roofRand() * 0.03
        if (roofRand() > 0.03) {
          /*
           * The gable runs along Z, so a roof board is thin in X, long in Y
           * before it is tilted, and w wide in Z. Building it (w, len, thin)
           * and then spinning it about Y — which is what this did at first —
           * lays the slope down the length of the barn instead of across it,
           * and opens a hole where the roof should meet the gable end.
           */
          const g = board(0.05, slopeLen, w, n * 31 + 7)
          g.rotateZ(side * (Math.PI / 2 - pitch))
          g.translate((side * HW) / 2, (eaveY + ridgeY) / 2, z + w / 2)
          roofBoards.push(g)
        }
        z += w + gap
        n++
      }
    }
    const roof = roofBoards.length ? mergeGeometries(roofBoards, false) : null
    roofBoards.forEach((g) => g.dispose())

    // Floor planks, running the length of the barn.
    const floorRand = rng(808)
    const floorBoards: THREE.BufferGeometry[] = []
    let x = -HW
    let fn = 0
    while (x < HW) {
      const w = 0.22 * (0.85 + floorRand() * 0.3)
      const g = board(w, backZ - frontZ, 0.06, fn * 31 + 5)
      g.rotateX(Math.PI / 2)
      g.translate(x + w / 2, 0.03, (frontZ + backZ) / 2)
      floorBoards.push(g)
      x += w + 0.006
      fn++
    }
    const floor = mergeGeometries(floorBoards, false)
    floorBoards.forEach((g) => g.dispose())

    // Frame: posts, plate, rafters, collar ties.
    const frameParts: THREE.BufferGeometry[] = []
    const post = (px: number, pz: number) => {
      const g = board(0.2, eaveY, 0.2, 2)
      g.translate(px, eaveY / 2, pz)
      frameParts.push(g)
    }
    for (const pz of [frontZ, -1, 1.5, 4, backZ]) {
      post(-HW + 0.1, pz)
      post(HW - 0.1, pz)
    }
    for (const px of [-HW + 0.1, HW - 0.1]) {
      const plate = board(0.22, backZ - frontZ, 0.26, 5)
      plate.rotateX(Math.PI / 2)
      plate.translate(px, eaveY, (frontZ + backZ) / 2)
      frameParts.push(plate)
    }
    /*
     * Rafters, collar ties and the ridge beam are kept apart from the posts
     * and plates below them. Same timber, different life: everything above
     * the eaves has had a century of dust settle on it and has never once
     * been touched, wiped or rained on, and it wants a duller, greyer surface
     * than the frame you can put your hand on.
     */
    const roofParts: THREE.BufferGeometry[] = []
    for (let z = frontZ + 0.4; z < backZ; z += 1.0) {
      for (const side of [-1, 1]) {
        const r = board(0.14, slopeLen, 0.18, 4)
        r.rotateZ(side * (Math.PI / 2 - pitch))
        r.translate((side * HW) / 2, (eaveY + ridgeY) / 2 - 0.12, z)
        roofParts.push(r)
      }
      const tie = board(0.13, HW * 0.9, 0.16, 6)
      tie.rotateZ(Math.PI / 2)
      tie.translate(0, eaveY + 1.0, z)
      roofParts.push(tie)
    }
    const ridge = board(0.2, backZ - frontZ, 0.24, 1)
    ridge.rotateX(Math.PI / 2)
    ridge.translate(0, ridgeY - 0.12, (frontZ + backZ) / 2)
    roofParts.push(ridge)

    const frame = mergeGeometries(frameParts, false)
    frameParts.forEach((g) => g.dispose())
    const rafters = mergeGeometries(roofParts, false)
    roofParts.forEach((g) => g.dispose())

    return { walls, roof, floor, frame, rafters }
  }, [])
}

export function Barn() {
  const { walls, roof, floor, frame, rafters } = useBarnGeometry()
  const maps = useWoodMaps(GRAIN.siding)
  const floorMaps = useWoodMaps(GRAIN.floor)

  /*
   * The same timber, at two grain scales and three finishes. Siding is
   * silvered by a century of weather; the frame kept more of its colour
   * because it never saw the sky; the floor is walked on, so it is darker,
   * smoother and shows a finer figure from the metre and a half you look at it
   * from. Running the floor on its own map set is what stopped it and the
   * tables reading as one continuous surface.
   */
  const sidingBase = useWoodMaterial(maps, {
    tint: '#ffffff',
    roughness: 1,
    normalScale: 1.35,
    side: THREE.DoubleSide,
  })
  const timberBase = useWoodMaterial(maps, { tint: '#c4a882', roughness: 0.95, normalScale: 1.1 })
  /*
   * Everything above the eaves, in dust.
   *
   * The tint is the point and it is doing real work, not decoration. Warm
   * timber lit by warm bounce and nothing else came out at 88% saturation —
   * the rafters were oxblood and the sheathing mustard, a stained-glass
   * ceiling. Dust is grey, it sits on top of the wood, and pulling the albedo
   * toward neutral is the one lever that actually reduces the saturation,
   * because a coloured light on a coloured surface multiplies both.
   */
  const dustyBase = useWoodMaterial(maps, { tint: '#bdb6a9', roughness: 1, normalScale: 0.9 })
  const roofBase = useWoodMaterial(maps, {
    tint: '#d8d1c3',
    roughness: 1,
    normalScale: 1.15,
    side: THREE.DoubleSide,
  })
  const floorBase = useWoodMaterial(floorMaps, {
    tint: '#8a6d4b',
    roughness: 0.72,
    normalScale: 0.7,
  })

  /*
   * And over all three, the layer that says where in the building you are.
   * See macro.ts — the tiled photograph carries the grain, and this carries
   * the walked path, the grime line up the wall, and the black patch by the
   * stove. Neither works without the other.
   */
  const wall = useWallMacro()
  const ground = useFloorMacro()
  const siding = useMemo(
    () => withMacro(sidingBase, wall, WALL_UV, 'macro-wall'),
    [sidingBase, wall],
  )
  const timber = useMemo(
    () => withMacro(timberBase, wall, WALL_UV, 'macro-wall'),
    [timberBase, wall],
  )
  const floorMat = useMemo(
    () => withMacro(floorBase, ground, FLOOR_UV, 'macro-floor'),
    [floorBase, ground],
  )
  const above = useRoofMacro()
  const roofMat = useMemo(
    () => withMacro(roofBase, above, ROOF_UV, 'macro-roof'),
    [roofBase, above],
  )
  const rafterMat = useMemo(
    () => withMacro(dustyBase, above, ROOF_UV, 'macro-roof'),
    [dustyBase, above],
  )

  return (
    <group>
      {walls && <mesh geometry={walls} material={siding} castShadow receiveShadow />}
      {roof && <mesh geometry={roof} material={roofMat} castShadow receiveShadow />}
      <mesh geometry={floor} material={floorMat} receiveShadow />
      <mesh geometry={frame} material={timber} castShadow receiveShadow />
      <mesh geometry={rafters} material={rafterMat} castShadow receiveShadow />
    </group>
  )
}
