import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Timber, as real material rather than a drawing of one.
 *
 * This used to be a canvas: grain and knots painted with 2D calls, applied as
 * a flat colour map. It was clever and it looked like a cartoon, for a reason
 * worth writing down — a colour map alone tells the renderer nothing about how
 * a surface catches light. Every board came back perfectly smooth and equally
 * shiny, so no matter how good the grain was, the wood read as printed paper.
 *
 * What makes wood look like wood is the other three maps:
 *
 *   normal      — the grain and the saw marks physically catch the light
 *   roughness   — worn edges go glossy, dry faces stay matte, unevenly
 *   AO          — cracks and joins self-shadow instead of glowing
 *
 * Source: Poly Haven `dark_wooden_planks`, CC0. See CREDITS.md.
 *
 * UVs are in metres, not per-face 0..1, so a plank two metres long shows twice
 * as much grain as a one-metre one. Getting that wrong is the other classic
 * tell: every board wearing the identical stretched pattern.
 */

/** World size, in metres, covered by one repeat of the texture. */
export const TILE_M = 1.35

export type WoodMaps = {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  aoMap: THREE.Texture
}

/**
 * The maps, at a chosen grain scale.
 *
 * `grain` multiplies the repeat, so a family can show the same timber at a
 * different size. This is the part that actually separated the surfaces. The
 * siding, the floor and the furniture were distinguished only by a colour
 * tint, and a tint does not separate anything — what the eye matches on is the
 * grain, and the identical knots at the identical size were turning up on the
 * wall behind you and the table in front of you. In the frame from your table
 * at midday the tabletop and the floorboards were genuinely hard to tell
 * apart.
 *
 * Anything other than the default clones the textures, because repeat lives on
 * the texture rather than the material and three needs distinct objects to
 * carry distinct transforms. A clone shares the decoded image; it costs one
 * more GPU upload of the same pixels, not another download.
 */
export function useWoodMaps(grain = 1): WoodMaps {
  const [map, normalMap, roughnessMap, aoMap] = useTexture([
    `${import.meta.env.BASE_URL}textures/planks/diff_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/nor_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/rough_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/ao_1k.jpg`,
  ])

  return useMemo(() => {
    const set = grain === 1
      ? { map, normalMap, roughnessMap, aoMap }
      : {
          map: map.clone(),
          normalMap: normalMap.clone(),
          roughnessMap: roughnessMap.clone(),
          aoMap: aoMap.clone(),
        }

    set.map.colorSpace = THREE.SRGBColorSpace
    // The other three are data, not colour. Tagging them sRGB washes out the
    // normals and lifts the roughness, and the wood goes plastic.
    for (const t of [set.normalMap, set.roughnessMap, set.aoMap]) {
      t.colorSpace = THREE.NoColorSpace
    }
    for (const t of [set.map, set.normalMap, set.roughnessMap, set.aoMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
      t.repeat.set(grain, grain)
      t.needsUpdate = true
    }
    return set
  }, [map, normalMap, roughnessMap, aoMap, grain])
}

/**
 * How big the grain runs on each family.
 *
 * Barn siding keeps the metre-based mapping the walls were built around.
 * Floorboards are walked on and looked at from a metre and a half, so they
 * carry more detail per metre. Furniture timber is planed and finer again, and
 * is the family that most needed to stop matching the floor.
 *
 * The floor is not pushed further than this on purpose. Floorboards run the
 * whole ten metres of the barn, so the tighter the grain the more times the
 * texture repeats along one board — and past about 1.3 the repeat stops
 * reading as grain and starts reading as a grid ruled across the floor, which
 * is worse than the sameness it was fixing.
 */
export const GRAIN = {
  siding: 1,
  floor: 1.25,
  furniture: 2.5,
} as const

/**
 * A material off those maps. `tint` shifts the species without needing a
 * second texture set — barn siding is silvered, floors and furniture are not.
 */
export function useWoodMaterial(
  maps: WoodMaps,
  opts: { tint?: string; roughness?: number; normalScale?: number; side?: THREE.Side } = {},
) {
  const { tint = '#ffffff', roughness = 1, normalScale = 1, side = THREE.FrontSide } = opts
  return useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        roughnessMap: maps.roughnessMap,
        aoMap: maps.aoMap,
        aoMapIntensity: 1,
        color: new THREE.Color(tint),
        roughness,
        metalness: 0,
        normalScale: new THREE.Vector2(normalScale, normalScale),
        side,
      }),
    [maps, tint, roughness, normalScale, side],
  )
}

/**
 * Map a board onto ONE plank of the source texture, running the right way.
 *
 * This is the whole difference between wood and masonry, and it caught me out.
 * The Poly Haven set is a *wall* of roughly nine horizontal planks. Mapping a
 * board's width across the texture's width and its length up the texture — the
 * obvious thing — drags each board across all nine, so a seam crosses it every
 * fifteen centimetres and the wall reads as stone blocks. Which is exactly
 * what it looked like.
 *
 * So the axes are swapped: the board's LENGTH runs along the texture's U, with
 * the grain, and its WIDTH is squeezed into a single plank's band in V. Each
 * board then shows continuous lengthwise grain off one real plank, and picking
 * a different band and offset per board means no two are the same.
 */
const BAND = 0.095

export function plankUVs(geom: THREE.BufferGeometry, length: number, seed: number) {
  const uv = geom.attributes.uv as THREE.BufferAttribute
  if (!uv) return geom
  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  // Land inside a plank rather than straddling a seam.
  const band = Math.floor(rand() * 9) / 9 + 0.012
  const along = rand() * 6
  const su = length / TILE_M

  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i)
    const v = uv.getY(i)
    uv.setXY(i, along + v * su, band + u * BAND)
  }
  uv.needsUpdate = true
  geom.setAttribute('uv1', uv.clone())
  return geom
}


/**
 * Box-project a turned object as though it were cut from boards.
 *
 * A lathe's own UVs are cylindrical — u runs round the axis, v along the
 * profile — which is right for the side of a column and catastrophic for
 * anything flat. On a table top it wraps the grain into concentric rings, and
 * a metre-and-a-quarter bullseye is the single loudest fake thing that has
 * been in this scene; the old cylinder happened to avoid it only because its
 * end caps carry a planar disc mapping.
 *
 * So each triangle is projected down whichever axis its own face normal
 * points along most. Per-triangle rather than per-vertex, because a smooth
 * lathe's vertex normals swing gradually and a vertex-by-vertex choice flips
 * partway across a face, which tears the texture along the seam. That needs
 * an unindexed geometry, which for a few hundred triangles costs nothing.
 *
 * The V axis is scaled so one of the source texture's nine planks covers one
 * board width, because a round top is glued up from boards and the texture's
 * own seams then land where real ones would. Scaling both axes the same way
 * instead drags each board across all nine planks and the timber reads as
 * masonry — the same trap `plankUVs` above exists to avoid.
 *
 * `grain` must match the value the maps were built at: repeat lives on the
 * texture and multiplies whatever is written here.
 */
const BOARD_W = 0.14

export function boardUVs(geom: THREE.BufferGeometry, grain: number, seed = 0) {
  const g = geom.index ? geom.toNonIndexed() : geom
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  const su = 1 / TILE_M
  const sv = BAND / (BOARD_W * grain)
  // Start inside a plank rather than straddling a seam.
  const offset = (Math.floor(((seed * 2654435761) >>> 0) / 4294967296 * 9) / 9 + 0.012) / grain

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const t = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    n.crossVectors(b.clone().sub(a), c.clone().sub(a))
    const nx = Math.abs(n.x)
    const ny = Math.abs(n.y)
    const nz = Math.abs(n.z)
    // Flat faces read boards across the plan; the edge band reads them
    // running round it, so the seams stay parallel to the ones on top.
    const axis = ny >= nx && ny >= nz ? 1 : nx >= nz ? 0 : 2
    for (let k = 0; k < 3; k++) {
      t.copy(k === 0 ? a : k === 1 ? b : c)
      const along = axis === 0 ? t.z : t.x
      const across = axis === 1 ? t.z : t.y
      uv[(i + k) * 2] = along * su
      uv[(i + k) * 2 + 1] = offset + across * sv
    }
  }

  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(), 2))
  return g
}

/**
 * Run the grain along a turned or swept object's axis.
 *
 * A lathe's V runs along the profile and its U runs round the axis, so the
 * source texture — a wall of nine horizontal planks — lays its plank seams
 * across the object as a stack of horizontal rings. On a table pedestal that
 * is unmistakable: it reads as a column built from stacked discs, which is
 * the one thing turned timber is not.
 *
 * Wood on a turned leg runs *along* it, so the axis has to be U, the same
 * direction the texture's own grain runs. What is left over — the way round —
 * is squeezed into a single plank's band, exactly as `plankUVs` does for
 * boards, so the object never crosses a seam. The squash across is severe on
 * anything fat, and it does not matter: across the grain is where timber has
 * least to show, and you only ever see half a circumference at once.
 */
function grainUVs(
  geom: THREE.BufferGeometry,
  grain: number,
  seed: number,
  alongOf: (i: number) => number,
  aroundOf: (i: number) => number,
) {
  const uv = geom.attributes.uv as THREE.BufferAttribute
  if (!uv) return geom
  const band = (Math.floor((((seed * 2654435761) >>> 0) / 4294967296) * 9) / 9 + 0.012) / grain
  const out = new Float32Array(uv.count * 2)
  for (let i = 0; i < uv.count; i++) {
    out[i * 2] = alongOf(i) / TILE_M
    out[i * 2 + 1] = band + (aroundOf(i) * BAND) / grain
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(out, 2))
  geom.setAttribute('uv1', new THREE.BufferAttribute(out.slice(), 2))
  return geom
}

/** A lathed object standing on its Y axis: grain up it, one plank round it. */
export function turnedUVs(geom: THREE.BufferGeometry, grain: number, seed = 0) {
  const pos = geom.attributes.position as THREE.BufferAttribute
  const uv = geom.attributes.uv as THREE.BufferAttribute
  if (!uv) return geom
  return grainUVs(geom, grain, seed, (i) => pos.getY(i), (i) => uv.getX(i))
}

/** A tube swept along a curve: grain follows the curve. */
export function sweptUVs(geom: THREE.BufferGeometry, grain: number, length: number, seed = 0) {
  const uv = geom.attributes.uv as THREE.BufferAttribute
  if (!uv) return geom
  // TubeGeometry lays U along the curve and V round it — the opposite of a
  // lathe, and already the way round we want.
  const u0 = new Float32Array(uv.count)
  const v0 = new Float32Array(uv.count)
  for (let i = 0; i < uv.count; i++) {
    u0[i] = uv.getX(i)
    v0[i] = uv.getY(i)
  }
  return grainUVs(geom, grain, seed, (i) => u0[i] * length, (i) => v0[i])
}

/**
 * A board with its edges taken off.
 *
 * The loudest remaining "this is CG" signal was that every edge in the room
 * was a perfect 90 degrees. Real sawn timber has an arris — worn, chamfered,
 * slightly rounded — and that edge catches a thin highlight from whatever the
 * brightest thing in the room is. Without it a plank has no silhouette, just a
 * hard line, and the eye reads it as a rectangle rather than an object.
 *
 * Kept to a 1-segment chamfer rather than a smooth radius: it is roughly ten
 * times the triangles of a plain box, and there are several hundred boards, so
 * the difference between a chamfer and a fillet is the difference between this
 * running on a phone and not. At 3mm across a 300mm board the eye cannot tell
 * them apart anyway — it only needs the highlight.
 */
export function chamferedBox(w: number, h: number, d: number, bevel = 0.004) {
  const r = Math.min(bevel, w / 2.5, h / 2.5, d / 2.5)
  return new RoundedBoxGeometry(w, h, d, 1, r)
}
