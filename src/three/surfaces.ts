import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Surfaces that are not the barn.
 *
 * Every material in the room came off one Poly Haven plank set — the siding,
 * the floor, the frame, the tables and the counter, separated only by a colour
 * tint. Tint cannot separate them, because what the eye actually matches on is
 * the *grain*: the same knots at the same size in the same places, on the wall
 * behind you and on the table in front of you. In the frame from your table at
 * midday the tabletop and the floorboards are genuinely hard to tell apart,
 * and the counter slab reads as another piece of floor stood on its side.
 *
 * The right fix is more downloaded PBR sets. That was not available here —
 * polyhaven.com, its CDN, Sketchfab and ambientCG are all refused by this
 * environment's egress policy — so this generates one, and the one chosen is
 * the one that breaks the sameness hardest: a stone counter. A café counter is
 * very often soapstone or slate, it is the surface the eye spends the most
 * time on at the counter stop, and being not-wood at all it cannot be confused
 * with the floor no matter what the light does.
 *
 * Generated rather than painted flat, because a colour map alone tells the
 * renderer nothing about how a surface catches light — the same lesson wood.ts
 * records. Normal and roughness are derived from the albedo by Sobel filter,
 * and derived at 512 rather than the full 1024: the design handoff is explicit
 * that full-resolution Sobel on several textures blocks the main thread for
 * seconds during load, and it is right.
 */

const SIZE = 1024
/** Sobel is derived at half resolution. See the handoff's gotcha 8. */
const DERIVE = 512

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Soapstone: dark, close-grained, with pale calcite veining.
 *
 * Drawn wrapping — every mark that runs off one edge is drawn again on the
 * opposite one — so the slab can tile without a seam running down it.
 */
function soapstoneAlbedo(): HTMLCanvasElement {
  const [c, ctx] = canvas(SIZE)
  const rand = seeded(90210)

  // Mid grey, not the near-black soapstone comes out of the ground as. This
  // corner of the barn is lit by one bulb and a doorway forty degrees off it;
  // a dark slab there stops being a surface and becomes a hole in the frame.
  ctx.fillStyle = '#6c726e'
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Broad tonal drift, so the slab is not one flat grey.
  for (let i = 0; i < 90; i++) {
    const x = rand() * SIZE
    const y = rand() * SIZE
    const r = 90 + rand() * 320
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const light = rand() > 0.5
    g.addColorStop(0, light ? 'rgba(140,146,142,0.20)' : 'rgba(56,60,58,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  /*
   * Veins. Each is a chain of short segments that wanders rather than curves
   * cleanly — a vein drawn as one smooth bezier reads as a scratch, because
   * real veining changes direction constantly and changes width with it.
   */
  const vein = (ox: number, oy: number) => {
    let x = rand() * SIZE
    let y = rand() * SIZE
    let a = rand() * Math.PI * 2
    const steps = 40 + Math.floor(rand() * 70)
    const pale = 130 + rand() * 70
    ctx.strokeStyle = `rgba(${pale},${pale + 4},${pale - 2},${0.10 + rand() * 0.2})`
    ctx.lineWidth = 0.6 + rand() * 2.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + ox, y + oy)
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.7
      x += Math.cos(a) * (7 + rand() * 12)
      y += Math.sin(a) * (7 + rand() * 12)
      ctx.lineTo(x + ox, y + oy)
    }
    ctx.stroke()
  }
  // Nine passes, offset by a full tile in each direction, so a vein leaving
  // the right edge arrives at the left.
  for (let i = 0; i < 26; i++) {
    for (const ox of [-SIZE, 0, SIZE]) for (const oy of [-SIZE, 0, SIZE]) vein(ox, oy)
  }

  // Grit. Stone is not smooth at this scale and a clean surface reads as vinyl.
  const img = ctx.getImageData(0, 0, SIZE, SIZE)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 16
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)

  return c
}

/** Luminance of a canvas, downsampled, as a height field. */
function heights(src: HTMLCanvasElement, size: number): Float32Array {
  const [, ctx] = canvas(size)
  ctx.drawImage(src, 0, 0, size, size)
  const d = ctx.getImageData(0, 0, size, size).data
  const h = new Float32Array(size * size)
  for (let i = 0; i < size * size; i++) {
    h[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255
  }
  return h
}

/** Tangent-space normal map from a height field, by Sobel. */
function normalFrom(h: Float32Array, size: number, strength: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        at(x + 1, y - 1) - 2 * at(x + 1, y) - at(x + 1, y + 1)
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        at(x - 1, y + 1) - 2 * at(x, y + 1) - at(x + 1, y + 1)
      let nx = dx * strength
      let ny = dy * strength
      const len = Math.hypot(nx, ny, 1)
      nx /= len
      ny /= len
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (1 / len) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}

/**
 * Roughness from the same height field.
 *
 * Inverted: the pale calcite veins are harder than the matrix around them, so
 * they take a polish and the darker stone stays matte. A constant roughness is
 * the thing that makes stone read as painted board — the whole surface
 * catching the window in exactly the same way at every point.
 */
function roughnessFrom(h: Float32Array, size: number, lo: number, hi: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < size * size; i++) {
    const v = (hi - (hi - lo) * Math.min(1, h[i] * 1.8)) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  return t
}

/** World size, in metres, covered by one repeat. A slab, not a tile floor. */
const STONE_TILE = 1.1

/**
 * The counter slab.
 *
 * Kept to a single shared material — there is one counter, and the back shelf
 * stays timber, which is what a real conversion would look like: a stone top
 * dropped onto a carpenter's carcass.
 */
export function useSoapstone(
  tint = '#b4bab6',
  /*
   * The gloss range the roughness map spans. Soapstone is oiled and takes a
   * sheen; firebrick has been baked at 400 degrees for thirty years and takes
   * none, and reusing the counter's range on the oven made it read as dark
   * glazed tile with cracks in it rather than as brick.
   */
  rough: [number, number] = [0.34, 0.72],
) {
  return useMemo(() => {
    const albedo = soapstoneAlbedo()
    const h = heights(albedo, DERIVE)

    const map = new THREE.CanvasTexture(albedo)
    map.colorSpace = THREE.SRGBColorSpace
    const normalMap = normalFrom(h, DERIVE, 2.4)
    const roughnessMap = roughnessFrom(h, DERIVE, rough[0], rough[1])

    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1 / STONE_TILE, 1 / STONE_TILE)
      t.anisotropy = 8
    }

    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      color: tint,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.7, 0.7),
      // Stone is a dielectric with a slightly higher index than wood, and the
      // grazing sheen along the front edge of a counter is most of what says
      // "stone" rather than "grey paint".
      envMapIntensity: 1.15,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tint, rough[0], rough[1]])
}

/**
 * Glazed stoneware, for the cups.
 *
 * These were a flat cream at roughness 0.38 and they clipped to pure white
 * wherever the sun reached them — a mug reading as a light source, with a
 * bloom halo, in the middle of the hero frame. Two things were wrong. The
 * albedo was 0.89, which no fired clay is; real white stoneware is nearer 0.7
 * and everything above that is the glaze, not the body. And a perfectly
 * uniform roughness on a perfectly round cylinder gives one enormous unbroken
 * specular lobe, where a thrown pot has a glaze that pools and thins.
 */
export function useStoneware(tint = '#cfc6b4') {
  return useMemo(() => {
    const [c, ctx] = canvas(256)
    const rand = seeded(1717)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 256, 256)
    // Where the glaze pooled it is glossier; where it ran thin, less so.
    for (let i = 0; i < 60; i++) {
      const x = rand() * 256
      const y = rand() * 256
      const r = 20 + rand() * 90
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const glossy = rand() > 0.45
      g.addColorStop(0, glossy ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.5)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    const roughnessMap = new THREE.CanvasTexture(c)
    roughnessMap.colorSpace = THREE.NoColorSpace
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping

    return new THREE.MeshStandardMaterial({
      color: tint,
      roughnessMap,
      roughness: 0.52,
      metalness: 0,
      envMapIntensity: 0.9,
    })
  }, [tint])
}

/**
 * Metal that has been in a room.
 *
 * The espresso machine and the stove were a box and a cylinder with a flat
 * colour and a metalness value, and flat metalness is the worst-behaved
 * material in a renderer: a perfectly uniform metal has a perfectly uniform
 * reflection, so a two-metre stove catches one even highlight across its whole
 * face and reads as painted plastic. What sells metal is that its roughness
 * varies — polished where hands touch it, dull where they do not, pitted where
 * it has been hot for thirty years.
 *
 * So both metals get a generated roughness map and a normal derived from it.
 * Cheap: one 512 canvas each, no download, and it is the difference between an
 * object and a placeholder.
 */
function metalRoughness(seed: number, lo: number, hi: number, blotches: number) {
  const [c, ctx] = canvas(512)
  const rand = seeded(seed)
  const mid = (lo + hi) / 2
  ctx.fillStyle = `rgb(${Math.round(mid * 255)},${Math.round(mid * 255)},${Math.round(mid * 255)})`
  ctx.fillRect(0, 0, 512, 512)

  for (let i = 0; i < blotches; i++) {
    const x = rand() * 512
    const y = rand() * 512
    const r = 6 + rand() * 70
    const v = Math.round((lo + rand() * (hi - lo)) * 255)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${v},${v},${v},0.5)`)
    g.addColorStop(1, `rgba(${v},${v},${v},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fine pitting, which is most of what says "cast" rather than "moulded".
  const img = ctx.getImageData(0, 0, 512, 512)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 26
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function metal(opts: {
  seed: number
  color: string
  lo: number
  hi: number
  metalness: number
  blotches: number
  repeat: number
  normalScale: number
}): THREE.MeshStandardMaterial {
  const rc = metalRoughness(opts.seed, opts.lo, opts.hi, opts.blotches)
  const roughnessMap = new THREE.CanvasTexture(rc)
  roughnessMap.colorSpace = THREE.NoColorSpace
  const normalMap = normalFrom(heights(rc, DERIVE), DERIVE, opts.normalScale)
  for (const t of [roughnessMap, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(opts.repeat, opts.repeat)
    t.anisotropy = 8
  }
  return new THREE.MeshStandardMaterial({
    color: opts.color,
    roughnessMap,
    normalMap,
    roughness: 1,
    metalness: opts.metalness,
    normalScale: new THREE.Vector2(0.5, 0.5),
    envMapIntensity: 1.1,
  })
}

/** Blacked stove iron: matte, pitted, barely reflective. */
export function useCastIron() {
  return useMemo(
    () =>
      metal({
        seed: 5150,
        color: '#3a3634',
        lo: 0.55,
        hi: 0.92,
        metalness: 0.62,
        blotches: 240,
        repeat: 2.2,
        normalScale: 1.4,
      }),
    [],
  )
}

/** Chromed boiler and group heads. Bright, but not a mirror — nothing is. */
export function useChrome() {
  return useMemo(
    () =>
      metal({
        seed: 2718,
        /*
         * Faintly warm, not neutral. The environment map is a Norwegian winter
         * HDRI, so neutral chrome reflects it and the boiler comes back blue —
         * correct physics, wrong object. Real machine chrome sits in a warm
         * room and picks the room up.
         */
        color: '#cfcac2',
        lo: 0.08,
        hi: 0.34,
        metalness: 1,
        blotches: 130,
        repeat: 1.6,
        normalScale: 0.5,
      }),
    [],
  )
}

/** Brass, for the fittings and the foot rail. */
export function useBrass() {
  return useMemo(
    () =>
      metal({
        seed: 1123,
        color: '#8f7442',
        lo: 0.22,
        hi: 0.55,
        metalness: 1,
        blotches: 150,
        repeat: 2,
        normalScale: 0.8,
      }),
    [],
  )
}
