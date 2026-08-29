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

/**
 * Powder-coated steel, with coffee in it.
 *
 * The grinder was wearing the stove's cast iron, and the two are not the same
 * material at all. A stove casting is sand-cast, matte and pitted; a grinder
 * body is a smooth shell sprayed with epoxy powder and baked, which comes out
 * semi-gloss with a fine orange-peel ripple. Reusing the iron made the machine
 * look like a stove part, and — worse — made it look unused.
 *
 * Because that is the other half of this. A grinder in a working café is never
 * clean. Fine grounds settle into every horizontal surface and every crease
 * within a foot of the doser, and the coat gets chipped down to bright metal
 * at the corners people knock portafilters against. Those two marks are most
 * of what separates a machine somebody uses from a render of a machine.
 *
 * Albedo and roughness are drawn in one pass rather than two, so that every
 * chip is shinier and every speck of coffee is rougher *in the same place*.
 * Drawing them in separate loops off the same seed would work right up until
 * someone edited one loop.
 */
export function useEnamel(tint = '#2b2825', dust = 1) {
  return useMemo(() => {
    const [ac, actx] = canvas(512)
    const [rc, rctx] = canvas(512)
    const rand = seeded(4004 + Math.round(dust * 97))

    actx.fillStyle = tint
    actx.fillRect(0, 0, 512, 512)
    // 0.34 — semi-gloss. Enamel is not a mirror and it is not chalk.
    rctx.fillStyle = 'rgb(87,87,87)'
    rctx.fillRect(0, 0, 512, 512)

    /*
     * Orange peel. Powder coat never lies perfectly flat: it pulls into a
     * fine dimpling as it cures, and that dimpling is what breaks a highlight
     * on a curved shell into something that reads as a sprayed finish rather
     * than as plastic.
     */
    for (let i = 0; i < 900; i++) {
      const x = rand() * 512
      const y = rand() * 512
      const r = 3 + rand() * 9
      const up = rand() > 0.5
      const g = rctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, up ? 'rgba(112,112,112,0.30)' : 'rgba(64,64,64,0.30)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      rctx.fillStyle = g
      rctx.beginPath()
      rctx.arc(x, y, r, 0, Math.PI * 2)
      rctx.fill()
    }

    /*
     * Chips, down to bare metal — and deliberately few.
     *
     * A coat chips at the corners and edges people knock portafilters
     * against, not evenly across a flat panel, and a tiling map has no idea
     * where the edges of the object are. Thirty of them at this repeat came
     * out as eighty bright specks sprayed over the shell, which read as
     * stars rather than as damage. Eight dim ones are honest about what a
     * flat map can do; the rest of the wear is carried by the dust, which
     * genuinely does settle everywhere.
     */
    for (let i = 0; i < 8; i++) {
      const x = rand() * 512
      const y = rand() * 512
      const r = 0.8 + rand() * 2
      actx.fillStyle = `rgba(104,106,104,${0.28 + rand() * 0.3})`
      actx.beginPath()
      actx.ellipse(x, y, r, r * (0.5 + rand()), rand() * 3, 0, Math.PI * 2)
      actx.fill()
      rctx.fillStyle = 'rgba(52,52,52,0.7)'
      rctx.beginPath()
      rctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2)
      rctx.fill()
    }

    // Grounds. Dark, matte, and small enough to read as dust rather than dirt.
    const specks = Math.round(1500 * dust)
    for (let i = 0; i < specks; i++) {
      const x = rand() * 512
      const y = rand() * 512
      const r = 0.4 + rand() * 1.3
      const a = 0.16 + rand() * 0.4
      actx.fillStyle = `rgba(38,22,12,${a})`
      actx.beginPath()
      actx.arc(x, y, r, 0, Math.PI * 2)
      actx.fill()
      rctx.fillStyle = `rgba(215,215,215,${a})`
      rctx.beginPath()
      rctx.arc(x, y, r * 1.5, 0, Math.PI * 2)
      rctx.fill()
    }

    // And where it has been wiped rather than cleaned: soft matte smears.
    for (let i = 0; i < Math.round(9 * dust); i++) {
      const x = rand() * 512
      const y = rand() * 512
      const r = 22 + rand() * 60
      const g = rctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(190,190,190,0.35)')
      g.addColorStop(1, 'rgba(190,190,190,0)')
      rctx.fillStyle = g
      rctx.beginPath()
      rctx.arc(x, y, r, 0, Math.PI * 2)
      rctx.fill()
    }

    const map = new THREE.CanvasTexture(ac)
    map.colorSpace = THREE.SRGBColorSpace
    const roughnessMap = new THREE.CanvasTexture(rc)
    roughnessMap.colorSpace = THREE.NoColorSpace
    const normalMap = normalFrom(heights(rc, DERIVE), DERIVE, 0.6)
    for (const t of [map, roughnessMap, normalMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(1.6, 1.6)
      t.anisotropy = 8
    }

    return new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      normalMap,
      roughness: 1,
      // Coated, not bare. A high metalness here is what made the old body
      // read as a polished casting rather than as a painted shell.
      metalness: 0.25,
      normalScale: new THREE.Vector2(0.45, 0.45),
      envMapIntensity: 0.9,
    })
  }, [tint, dust])
}

/**
 * Firebrick, in courses.
 *
 * The oven was wearing the counter's soapstone at a brown tint, on the theory
 * that firebrick and soapstone are the same problem — a dense, matte, unevenly
 * worn stone, differing only in colour. That was wrong, and the render says so
 * plainly: soapstone's veining is long pale streaks, and at oven scale they
 * came out as a craze of fine cracks over a two-metre slab. It read as tooled
 * leather.
 *
 * What makes brick read as brick is not its colour or its mottling. It is
 * **courses**. A repeating grid of units with recessed joints, offset by half
 * a unit each row, is the entire signal, and it is legible at any distance
 * down to a silhouette. No amount of surface noise substitutes for it.
 *
 * Firebrick is also not red. A bread oven is lined and faced with refractory
 * brick, which is a pale buff-cream, and it is the soot that darkens it.
 */
const BRICKS_ACROSS = 5
const COURSES = 14
/** Firebrick, sorted pale to dark. Real ones vary batch to batch. */
const FIREBRICK = ['#a8906a', '#9b8460', '#8e7757', '#ae9a75', '#847053', '#9d8965']

export function useFirebrick(soot = 1) {
  return useMemo(() => {
    const [ac, actx] = canvas(SIZE)
    // Height is drawn separately, because a dark brick is not a low one: the
    // normal has to come off the joints, not off the colour variation.
    const [hc, hctx] = canvas(SIZE)
    const rand = seeded(4242)

    const bw = SIZE / BRICKS_ACROSS
    const bh = SIZE / COURSES
    // 10mm of mortar on a 230mm brick. The first pass ran twice this and
    // the oven came back as tiled grout.
    const joint = SIZE * 0.0045

    actx.fillStyle = '#6f675b'
    actx.fillRect(0, 0, SIZE, SIZE)
    hctx.fillStyle = '#4a4a4a'
    hctx.fillRect(0, 0, SIZE, SIZE)

    for (let row = 0; row < COURSES; row++) {
      const y = row * bh
      // Half-bond. Drawn from -1 so the brick straddling the left edge is
      // there too, and the map tiles without a seam down it.
      const shift = row % 2 === 0 ? 0 : bw / 2
      for (let col = -1; col < BRICKS_ACROSS + 1; col++) {
        const x = col * bw + shift
        const face = FIREBRICK[Math.floor(rand() * FIREBRICK.length)]
        actx.fillStyle = face
        actx.fillRect(x + joint, y + joint, bw - joint * 2, bh - joint * 2)
        hctx.fillStyle = `rgb(${190 + Math.floor(rand() * 40)},190,190)`
        hctx.fillRect(x + joint, y + joint, bw - joint * 2, bh - joint * 2)

        // Every brick a little different across its own face, or five colours
        // in a grid read as tiles.
        for (let i = 0; i < 5; i++) {
          const g = actx.createRadialGradient(
            x + rand() * bw, y + rand() * bh, 0,
            x + rand() * bw, y + rand() * bh, 20 + rand() * 60,
          )
          const dark = rand() > 0.5
          g.addColorStop(0, dark ? 'rgba(120,104,80,0.16)' : 'rgba(255,248,228,0.16)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
          actx.save()
          actx.beginPath()
          actx.rect(x + joint, y + joint, bw - joint * 2, bh - joint * 2)
          actx.clip()
          actx.fillStyle = g
          actx.fillRect(x, y, bw, bh)
          actx.restore()
        }

        // A chipped corner here and there, down to the darker body.
        if (rand() > 0.86) {
          const cx = x + (rand() > 0.5 ? joint : bw - joint)
          const cy = y + (rand() > 0.5 ? joint : bh - joint)
          const r = 4 + rand() * 12
          actx.fillStyle = 'rgba(150,132,104,0.75)'
          actx.beginPath()
          actx.arc(cx, cy, r, 0, Math.PI * 2)
          actx.fill()
          hctx.fillStyle = 'rgba(90,90,90,0.8)'
          hctx.beginPath()
          hctx.arc(cx, cy, r, 0, Math.PI * 2)
          hctx.fill()
        }
      }
    }

    /*
     * Soot, and far more of it than looked right on the canvas.
     *
     * Held at the level that reads correctly on the map it vanished entirely
     * in the room: the bakery is lit through a north window and the oven face
     * takes that light flat, so the brick came back as clean new sandstone
     * blocks. An oven lit every morning for a century is nearer brown than
     * buff, and a map has to be laid on hard enough to survive the exposure it
     * will actually be seen at.
     */
    for (let i = 0; i < Math.round(260 * soot); i++) {
      const x = rand() * SIZE
      const y = rand() * SIZE
      const r = 14 + rand() * 110
      const g = actx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(22,17,13,${0.1 + rand() * 0.3})`)
      g.addColorStop(1, 'rgba(22,17,13,0)')
      actx.fillStyle = g
      actx.beginPath()
      actx.arc(x, y, r, 0, Math.PI * 2)
      actx.fill()
    }

    const map = new THREE.CanvasTexture(ac)
    map.colorSpace = THREE.SRGBColorSpace
    /*
     * A very gentle normal, and this took three passes to accept.
     *
     * A hard step from mortar to brick in the height field puts a big Sobel
     * gradient right at the joint, which lights up as a bevel round every
     * unit — and a chamfered edge is a ceramic detail. It read as glazed
     * subway tile at 2.6 and still did at 1.1. Recessed joints are real and
     * should catch light; the fix was narrowing them and dropping the
     * amplitude until what is left reads as a shadow line rather than a
     * moulded edge.
     */
    const h = heights(hc, DERIVE)
    const normalMap = normalFrom(h, DERIVE, 0.65)
    const roughnessMap = roughnessFrom(h, DERIVE, 0.72, 0.97)
    for (const t of [map, normalMap, roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      /*
       * Uneven, because a box's UVs are 0..1 per face whatever its size — so
       * repeat is counted in faces, not metres, and the oven's front is 1.5
       * wide by 1.7 tall. These land 6.5 bricks across it and 22 courses up:
       * a 230mm brick on a 76mm course, which is a brick.
       */
      t.repeat.set(1.3, 1.6)
      t.anisotropy = 8
    }

    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap,
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.3, 0.3),
      envMapIntensity: 0.4,
    })
  }, [soot])
}
