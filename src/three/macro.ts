import { useMemo } from 'react'
import * as THREE from 'three'
import { BARN } from '../scene/barn'

/**
 * Where people have actually walked, and where the rain gets in.
 *
 * The floor and the walls have the opposite problem to the tables. A table is
 * small enough to bake a map of its own; a floor is twelve metres by ten, and
 * a non-tiling map of it at any useful resolution would be 8k. So the floor
 * has to stay tiled — and a tiled floor is uniform by construction. Every
 * board is worn exactly as much as every other board, which is the same lie
 * the shared table material was telling, at forty times the size.
 *
 * Per-board randomisation does not fix it. Barn.tsx already gives every board
 * its own plank and offset, and the floor still reads as evenly worn, because
 * what is missing is not variety — it is *structure*. Wear is not noise. It
 * follows the door to the counter, stops under the furniture, blackens by the
 * stove and turns to grey grit at the threshold. A person reading the frame
 * knows all of that without being able to say so, and its absence is most of
 * why an empty room renders as a set.
 *
 * So: keep the tiled photograph for everything fine — grain, saw marks, the
 * nail holes — and multiply a second, very low-frequency map over the top of
 * it, keyed on where a fragment actually is in the building. 23mm per texel
 * sounds hopeless and is not, because everything in this layer is a soft
 * gradient. Wear has no edges.
 *
 * The map is sampled through a hand-written uniform rather than one of
 * three's own slots, which means no colour-space decode happens on the way
 * in. That is the right treatment here: these are multipliers, not colours.
 * Neutral is 1.0 for tint and 0.5 for roughness.
 */

const S = 512

function surface(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = S
  return [c, c.getContext('2d')!]
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function blot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha: number,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${alpha})`)
  g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.45})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * A worn band along a route, airbrushed.
 *
 * Stroking the polyline several times at widening line widths is the obvious
 * way to get a soft edge without `ctx.filter` — which is one line and is not
 * universally safe, Safari having only grown it recently. It does not work.
 * Each pass lays a constant alpha across its whole width, so the result is a
 * staircase: the paths came out ringed with contour lines like a map, and at
 * seven passes they were plainly visible.
 *
 * Stamping soft radial dabs along the path instead is both smoother and more
 * honest about what it is modelling. Overlapping gradients accumulate to a
 * band with no edge anywhere in it, which is what a walked route is.
 */
function walk(
  ctx: CanvasRenderingContext2D,
  path: [number, number][],
  width: number,
  rgb: string,
  alpha: number,
) {
  // Close enough together that no single dab is separable from its neighbours.
  const step = Math.max(2, width / 12)
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1]
    const [x1, y1] = path[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(len / step))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      blot(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width, rgb, alpha)
    }
  }
}

/** Where the floor map's 0,0 and 1,1 sit in the building. */
const FLOOR = {
  x0: -BARN.halfWidth,
  z0: BARN.frontZ,
  w: BARN.halfWidth * 2,
  d: BARN.backZ - BARN.frontZ,
}

const fx = (x: number) => ((x - FLOOR.x0) / FLOOR.w) * S
const fz = (z: number) => ((z - FLOOR.z0) / FLOOR.d) * S
const fp = (x: number, z: number): [number, number] => [fx(x), fz(z)]

/**
 * The routes through the room.
 *
 * Everyone comes in the door, and from there there are exactly three places
 * to go: the counter, a table, or back out. The counter run is the deepest
 * because it is walked twice by everyone; the way through to the bakery is
 * only walked by whoever is working.
 */
const ROUTES: { path: [number, number][]; width: number; wear: number }[] = [
  // Door to the counter, and along the front of it.
  {
    path: [fp(0, -4.2), fp(0.6, -2.4), fp(1.9, -1.0), fp(2.9, 0.2), fp(3.0, 2.2)],
    width: 34,
    wear: 1,
  },
  // Door to your table, and on past it.
  { path: [fp(0, -3.4), fp(0.4, 0.6), fp(0.5, 2.4), fp(1.6, 4.0)], width: 28, wear: 0.72 },
  // Across to the tables and the bench on the south side.
  { path: [fp(-0.6, -2.2), fp(-2.6, 0.4), fp(-4.0, 2.0), fp(-4.4, 3.6)], width: 26, wear: 0.6 },
  // Behind the counter, and through to the bakery. Staff only, so narrow.
  { path: [fp(4.6, -1.2), fp(4.7, 2.0), fp(3.6, 4.6), fp(2.4, 5.8)], width: 18, wear: 0.85 },
]

/** Things that stand still, and so keep the floor under them new. */
const STANDING: [number, number, number][] = [
  [0.9, 3.1, 0.8],
  [-3.2, 0.4, 0.7],
  [-3.4, 3.4, 0.7],
  [3.0, 4.2, 0.7],
  [-5.5, 2.2, 0.9],
  [-5.1, 3.4, 0.6],
  [4.1, 1.0, 1.4],
]

export function floorMacroMaps(): { tint: HTMLCanvasElement; rough: HTMLCanvasElement } {
  const [tc, tint] = surface()
  const [rc, rough] = surface()
  const rand = seeded(60660)

  tint.fillStyle = '#ffffff'
  tint.fillRect(0, 0, S, S)
  // 128 is neutral. Below it the surface takes more of a shine.
  rough.fillStyle = 'rgb(128,128,128)'
  rough.fillRect(0, 0, S, S)

  // Broad drift, so nothing anywhere is exactly the base value.
  for (let i = 0; i < 40; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 40 + rand() * 150
    const dark = rand() > 0.5
    blot(tint, x, y, r, dark ? '150,132,110' : '255,248,232', 0.16)
    blot(rough, x, y, r, dark ? '150,150,150' : '110,110,110', 0.3)
  }

  /*
   * The routes. Traffic does two things at once and they pull in opposite
   * directions: it darkens bare timber, because dirt is ground into it, and
   * it *polishes* it, because a hundred thousand boot soles are a very slow
   * sander. Doing only the darkening gives a dirty floor; doing only the
   * polish gives a varnished one. Both together is a floor.
   */
  for (const r of ROUTES) {
    /*
     * Weighted toward the shine rather than the dirt. At equal strength the
     * darkening won, and a broad soft dark band lying across a floor does not
     * read as wear at all — it reads as a cloud going over. Traffic announces
     * itself by catching the light differently, not by being a different
     * colour, so the tint does about a third of what the roughness does.
     */
    walk(tint, r.path, r.width, '104,84,62', 0.028 * r.wear)
    walk(rough, r.path, r.width, '58,58,58', 0.075 * r.wear)
  }

  // Under the furniture the floor is newer: lighter, and never polished.
  for (const [x, z, m] of STANDING) {
    blot(tint, fx(x), fz(z), 34 * m, '255,246,225', 0.42)
    blot(rough, fx(x), fz(z), 34 * m, '178,178,178', 0.55)
  }

  /*
   * The threshold. Three metres of doorway open to the weather all winter:
   * boards go grey, grit gets tracked in, and nothing there ever takes a
   * polish. This is the one part of the floor that is a different colour
   * rather than a different tone.
   */
  for (let i = 0; i < 16; i++) {
    const x = -1.9 + rand() * 3.8
    const z = -4.0 + rand() * (0.5 + rand() * 1.2)
    blot(tint, fx(x), fz(z), 14 + rand() * 26, '176,178,176', 0.3)
    blot(rough, fx(x), fz(z), 14 + rand() * 26, '196,196,196', 0.5)
  }

  // And by the stove: a century of embers dropped on the way to the firebox.
  blot(tint, fx(-4.4), fz(4.0), 44, '84,66,52', 0.55)
  blot(rough, fx(-4.4), fz(4.0), 44, '164,164,164', 0.5)
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * 30
    blot(tint, fx(-4.4) + Math.cos(a) * d, fz(4.0) + Math.sin(a) * d, 5 + rand() * 9, '46,36,30', 0.5)
  }

  return { tint: tc, rough: rc }
}

export function useFloorMacro() {
  return useMemo(() => {
    const m = floorMacroMaps()
    return maps(m.tint, m.rough)
  }, [])
}

/**
 * The walls, which have one story and it runs vertically.
 *
 * Barn siding is not evenly weathered top to bottom. The last half metre
 * takes everything — splash off the ground outside, boots and hay inside, a
 * century of it — and the top takes sun through the gaps and bleaches. That
 * gradient is the whole content here; the horizontal variation exists only so
 * the gradient does not read as a painted band.
 *
 * Keyed on x + z rather than on either alone, because all four walls and the
 * roof share one material and one merged geometry. The sum runs continuously
 * round a corner, so nothing seams, and it means nothing physically — it is
 * there to decorrelate, and height is doing the work.
 */
export function wallMacroMaps(): { tint: HTMLCanvasElement; rough: HTMLCanvasElement } {
  const [tc, tint] = surface()
  const [rc, rough] = surface()
  const rand = seeded(31337)

  tint.fillStyle = '#ffffff'
  tint.fillRect(0, 0, S, S)
  rough.fillStyle = 'rgb(128,128,128)'
  rough.fillRect(0, 0, S, S)

  /*
   * V runs 0 at the floor to 1 at the ridge, and with flipY off that is the
   * canvas top to the canvas bottom. Height is the whole gradient.
   *
   * It holds at full strength through the first half metre before it starts
   * to fade. The first version faded from the very bottom pixel, so exactly
   * one row of the map was ever fully dirty and the wall came back looking
   * washed. Grime is not a gradient with a point on it; it is a band with a
   * soft top edge.
   *
   * There is no bleached highlight up near the eaves any more. Weathering
   * silvers the *outside* of siding — inside it only ever gets darker — and
   * pale-over-white was doing nothing regardless.
   */
  const grimeTo = 2.6 / BARN.ridgeY
  const g = tint.createLinearGradient(0, 0, 0, S)
  g.addColorStop(0, 'rgba(88,76,62,0.62)')
  g.addColorStop(0.055, 'rgba(88,76,62,0.5)')
  // A long tail rather than a short one: a hard-ish stop at head height
  // reads as a painted dado rail running round the whole building.
  g.addColorStop(grimeTo * 0.45, 'rgba(88,76,62,0.19)')
  g.addColorStop(grimeTo, 'rgba(88,76,62,0)')
  tint.fillStyle = g
  tint.fillRect(0, 0, S, S)

  const gr = rough.createLinearGradient(0, 0, 0, S)
  gr.addColorStop(0, 'rgba(196,196,196,0.78)')
  gr.addColorStop(0.055, 'rgba(196,196,196,0.64)')
  gr.addColorStop(grimeTo * 0.45, 'rgba(196,196,196,0.24)')
  gr.addColorStop(grimeTo, 'rgba(196,196,196,0)')
  rough.fillStyle = gr
  rough.fillRect(0, 0, S, S)

  // Damp running down from the eaves, wherever the roof has failed.
  for (let i = 0; i < 12; i++) {
    const x = rand() * S
    const from = S * (0.65 + rand() * 0.35)
    const len = S * (0.15 + rand() * 0.45)
    walk(
      tint,
      [
        [x, from],
        [x + (rand() - 0.5) * 22, from - len],
      ],
      10 + rand() * 20,
      '104,94,78',
      0.03,
    )
  }

  // Broad blotches, so no two boards weathered alike.
  for (let i = 0; i < 34; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 24 + rand() * 90
    const dark = rand() > 0.45
    blot(tint, x, y, r, dark ? '146,136,118' : '255,250,238', 0.14)
    blot(rough, x, y, r, dark ? '146,146,146' : '112,112,112', 0.26)
  }

  return { tint: tc, rough: rc }
}

export function useWallMacro() {
  return useMemo(() => {
    const m = wallMacroMaps()
    return maps(m.tint, m.rough)
  }, [])
}

/**
 * The roof, unfolded.
 *
 * A gable roof is two planes joined at the ridge, and the natural way to lay
 * that on one map is to flatten it the way you would a cardboard box: the
 * -X eave along the bottom edge, the ridge across the middle, the +X eave
 * along the top. Both slopes then live on the same map and the two sides can
 * differ, which matters because the stove's flue only comes out of one of
 * them.
 *
 * What is on it:
 *
 * **Dust, thickening toward the ridge.** Nothing up there has ever been
 * touched. It is the only surface in the building where the wear gets worse
 * the further it is from anybody.
 *
 * **The smoke stain.** A hundred years of a wood stove leaves a dark cone on
 * the boards around where the flue goes through, and it is not symmetrical:
 * the plume leans up-slope, toward the ridge, because that is where the heat
 * goes. This is the one mark on the whole roof that a visitor could point at
 * and say what it is, which makes it worth more than the rest of the file.
 *
 * **Bleaching along the eaves.** The sheathing near the wall plate sees
 * daylight through the gap under the eave all day. Weathered timber that gets
 * light goes pale; timber in the dark goes brown.
 */
const ROOF = { z0: BARN.frontZ, d: BARN.backZ - BARN.frontZ }

/** Where the flue passes through, on the unfolded map. */
const FLUE = { x: -4.4, z: 4.2 }

export function roofMacroMaps(): { tint: HTMLCanvasElement; rough: HTMLCanvasElement } {
  const [tc, tint] = surface()
  const [rc, rough] = surface()
  const rand = seeded(90909)

  tint.fillStyle = '#ffffff'
  tint.fillRect(0, 0, S, S)
  rough.fillStyle = 'rgb(128,128,128)'
  rough.fillRect(0, 0, S, S)

  /*
   * V = 0 and V = 1 are the two eaves; V = 0.5 is the ridge. So the dust
   * gradient is symmetric about the middle, and the eaves are the clean end.
   */
  const dust = tint.createLinearGradient(0, 0, 0, S)
  dust.addColorStop(0, 'rgba(216,213,206,0.35)')
  dust.addColorStop(0.5, 'rgba(172,169,163,0.62)')
  dust.addColorStop(1, 'rgba(216,213,206,0.35)')
  tint.fillStyle = dust
  tint.fillRect(0, 0, S, S)

  // Dust is matte, and there is no varnish under it anyway.
  const dr = rough.createLinearGradient(0, 0, 0, S)
  dr.addColorStop(0, 'rgba(180,180,180,0.45)')
  dr.addColorStop(0.5, 'rgba(205,205,205,0.7)')
  dr.addColorStop(1, 'rgba(180,180,180,0.45)')
  rough.fillStyle = dr
  rough.fillRect(0, 0, S, S)

  // Bleaching in the last half metre before the eave, both sides.
  for (const edge of [0, S]) {
    const g = tint.createLinearGradient(0, edge, 0, edge === 0 ? S * 0.16 : S * 0.84)
    g.addColorStop(0, 'rgba(255,252,244,0.4)')
    g.addColorStop(1, 'rgba(255,252,244,0)')
    tint.fillStyle = g
    tint.fillRect(0, edge === 0 ? 0 : S * 0.84, S, S * 0.16)
  }

  // Broad drift, so no two bays look alike.
  for (let i = 0; i < 30; i++) {
    blot(
      tint,
      rand() * S,
      rand() * S,
      30 + rand() * 110,
      rand() > 0.5 ? '150,142,128' : '255,250,240',
      0.13,
    )
  }

  /*
   * The smoke. Drawn as a plume rather than a disc — a stack leaks upward
   * along the slope, so the stain runs from the collar toward the ridge and
   * fans as it goes.
   */
  const u = ((FLUE.z - ROOF.z0) / ROOF.d) * S
  const t = (BARN.eaveY + (BARN.ridgeY - BARN.eaveY) * (1 - Math.abs(FLUE.x) / BARN.halfWidth) - BARN.eaveY) /
    (BARN.ridgeY - BARN.eaveY)
  // Negative x, so the -X half of the unfolded map: V below the ridge.
  const v = (0.5 - 0.5 * (1 - t)) * S

  blot(tint, u, v, 34, '46,38,30', 0.5)
  for (let i = 0; i < 34; i++) {
    const up = i / 34
    blot(
      tint,
      u + (rand() - 0.5) * 34 * (0.4 + up),
      v + up * 96,
      22 + up * 52,
      '58,48,38',
      0.14 * (1 - up * 0.7),
    )
  }
  blot(rough, u, v, 58, '190,190,190', 0.45)

  return { tint: tc, rough: rc }
}

export function useRoofMacro() {
  return useMemo(() => {
    const m = roofMacroMaps()
    return maps(m.tint, m.rough)
  }, [])
}

function maps(tc: HTMLCanvasElement, rc: HTMLCanvasElement) {
  const tintMap = new THREE.CanvasTexture(tc)
  const roughMap = new THREE.CanvasTexture(rc)
  for (const t of [tintMap, roughMap]) {
    // Multipliers, not colour. See the note at the top of the file.
    t.colorSpace = THREE.NoColorSpace
    /*
     * The canvas is drawn in building coordinates, so its first row has to
     * stay the low end of the axis. three flips images on upload by default,
     * which puts V=0 at the canvas's *bottom* row — so the floor's wear came
     * out mirrored front to back: the grit tracked in at the doorway was
     * sitting in the bakery hatch, and the stove had scorched the far corner.
     * A render cannot show this, because a worn floor looks like a worn floor
     * whichever way round it is.
     */
    t.flipY = false
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.magFilter = THREE.LinearFilter
  }
  return { tintMap, roughMap }
}

/** How a fragment's position in the building becomes a macro coordinate. */
export const FLOOR_UV = `vec2(
  (position.x - ${FLOOR.x0.toFixed(2)}) / ${FLOOR.w.toFixed(2)},
  (position.z - ${FLOOR.z0.toFixed(2)}) / ${FLOOR.d.toFixed(2)}
)`

/**
 * The unfolded roof: along the barn in U, and across both slopes in V.
 *
 * V walks from the -X eave at 0, up that slope to the ridge at 0.5, and back
 * down the +X slope to its eave at 1. `sign(position.x)` is what separates
 * the two halves, and it is the only reason the smoke stain lands on the one
 * slope the flue actually comes out of.
 */
export const ROOF_UV = `vec2(
  (position.z - ${BARN.frontZ.toFixed(2)}) / ${(BARN.backZ - BARN.frontZ).toFixed(2)},
  0.5 + 0.5 * sign(position.x) * (1.0 - clamp(
    (position.y - ${BARN.eaveY.toFixed(2)}) / ${(BARN.ridgeY - BARN.eaveY).toFixed(2)}, 0.0, 1.0))
)`

export const WALL_UV = `vec2(
  fract((position.x + position.z + 10.0) / 22.0),
  clamp(position.y / ${BARN.ridgeY.toFixed(2)}, 0.0, 1.0)
)`

/**
 * Multiply a macro layer into a standard material.
 *
 * Patched in rather than built as a custom shader, so the material keeps
 * everything three does for it — shadows, tone mapping, the environment map,
 * the shafts' own depth pass — and gains two lines.
 */
export function withMacro(
  material: THREE.MeshStandardMaterial,
  layer: { tintMap: THREE.Texture; roughMap: THREE.Texture },
  uv: string,
  key: string,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMacroTint = { value: layer.tintMap }
    shader.uniforms.uMacroRough = { value: layer.roughMap }

    shader.vertexShader = `varying vec2 vMacroUv;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n  vMacroUv = ${uv};`,
    )

    shader.fragmentShader = `
      uniform sampler2D uMacroTint;
      uniform sampler2D uMacroRough;
      varying vec2 vMacroUv;
      ${shader.fragmentShader}`
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\n  diffuseColor.rgb *= texture2D( uMacroTint, vMacroUv ).rgb;',
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n  roughnessFactor *= texture2D( uMacroRough, vMacroUv ).g * 2.0;',
      )
  }
  // Or three hands every macro'd material the first one's compiled program.
  material.customProgramCacheKey = () => key
  return material
}
