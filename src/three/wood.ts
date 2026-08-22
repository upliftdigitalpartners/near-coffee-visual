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

export function useWoodMaps(): WoodMaps {
  const [map, normalMap, roughnessMap, aoMap] = useTexture([
    `${import.meta.env.BASE_URL}textures/planks/diff_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/nor_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/rough_1k.jpg`,
    `${import.meta.env.BASE_URL}textures/planks/ao_1k.jpg`,
  ])

  return useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace
    // The other three are data, not colour. Tagging them sRGB washes out the
    // normals and lifts the roughness, and the wood goes plastic.
    for (const t of [normalMap, roughnessMap, aoMap]) {
      t.colorSpace = THREE.NoColorSpace
    }
    for (const t of [map, normalMap, roughnessMap, aoMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 8
    }
    return { map, normalMap, roughnessMap, aoMap }
  }, [map, normalMap, roughnessMap, aoMap])
}

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
