import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOARD_VARIANTS, boardUV, woodTextures } from './wood'

/**
 * The barn.
 *
 * A Mormon Row homestead barn, of the kind standing in Grand Teton National
 * Park a couple of miles off the Snake River — timber frame, vertical
 * board-and-batten siding, gable roof, and a big sliding door on the gable end
 * that frames the range when it is open.
 *
 * The single most important decision in this file is that the siding is built
 * from individual boards with real gaps between them, rather than a wall with
 * a wood texture on it. Gaps mean the sun genuinely gets through and lays
 * stripes across the floor and the counter, and no amount of texturing
 * reproduces that. It is the reason to use 3D here at all.
 *
 * Units are metres. The door faces -Z, which is west — so the evening sun
 * comes straight in through the opening and along the gaps in the south wall.
 */

export const BARN = {
  halfWidth: 6,
  frontZ: -4,
  backZ: 6,
  eaveY: 4.6,
  ridgeY: 7.2,
  /**
   * The open sliding door on the gable end.
   *
   * Kept to 3.6m. At five metres across it stops being a door you look
   * through and becomes a missing wall: stand anywhere near it and the
   * opening subtends more than the entire field of view, so the barn
   * disappears and you are left looking at an unframed photograph.
   */
  door: { x0: -1.8, x1: 1.8, y1: 3.4 },
  /** A small opening on the south wall, for cross light. */
  sideWindow: { z0: 0.4, z1: 2.2, y0: 1.9, y1: 3.1 },
} as const

const BOARD_W = 0.30
const BOARD_T = 0.045
/** Texture tiles every this many metres along a board's length. */
const TILE_M = 2.4

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * A box whose UVs are remapped onto one column of the board atlas and tiled
 * along its length, so each board shows different grain.
 */
function board(
  w: number,
  h: number,
  d: number,
  variant: number,
  along: 'y' | 'z' = 'y',
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  const { offsetX, repeatX } = boardUV(variant)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const runLength = along === 'y' ? h : d
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(
      i,
      offsetX + uv.getX(i) * repeatX,
      uv.getY(i) * (runLength / TILE_M),
    )
  }
  uv.needsUpdate = true
  return g
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
        const variant = n % BOARD_VARIANTS
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
        const variant = (n + 3) % BOARD_VARIANTS
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

    // Back (east) gable end.
    all.push(
      ...sideOfBoards({
        seed: 202,
        u0: -HW,
        u1: HW,
        heightAt: gableHeight,
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
          const g = board(0.05, slopeLen, w, n % BOARD_VARIANTS)
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
      const g = board(w, backZ - frontZ, 0.06, fn % BOARD_VARIANTS, 'y')
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
    // Rafter pairs.
    for (let z = frontZ + 0.4; z < backZ; z += 1.0) {
      for (const side of [-1, 1]) {
        const r = board(0.14, slopeLen, 0.18, 4)
        r.rotateZ(side * (Math.PI / 2 - pitch))
        r.translate((side * HW) / 2, (eaveY + ridgeY) / 2 - 0.12, z)
        frameParts.push(r)
      }
      const tie = board(0.13, HW * 0.9, 0.16, 6)
      tie.rotateZ(Math.PI / 2)
      tie.translate(0, eaveY + 1.0, z)
      frameParts.push(tie)
    }
    const ridge = board(0.2, backZ - frontZ, 0.24, 1)
    ridge.rotateX(Math.PI / 2)
    ridge.translate(0, ridgeY - 0.12, (frontZ + backZ) / 2)
    frameParts.push(ridge)

    const frame = mergeGeometries(frameParts, false)
    frameParts.forEach((g) => g.dispose())

    return { walls, roof, floor, frame }
  }, [])
}

export function Barn() {
  const { walls, roof, floor, frame } = useBarnGeometry()
  const { map, rough } = useMemo(woodTextures, [])

  const siding = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        roughnessMap: rough,
        roughness: 0.94,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [map, rough],
  )

  const timber = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        roughnessMap: rough,
        roughness: 0.9,
        metalness: 0,
        color: new THREE.Color('#8a7358'),
      }),
    [map, rough],
  )

  return (
    <group>
      {walls && <mesh geometry={walls} material={siding} castShadow receiveShadow />}
      {roof && <mesh geometry={roof} material={siding} castShadow receiveShadow />}
      <mesh geometry={floor} material={timber} receiveShadow />
      <mesh geometry={frame} material={timber} castShadow receiveShadow />
    </group>
  )
}
