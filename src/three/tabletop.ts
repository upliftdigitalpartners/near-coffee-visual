import { useMemo } from 'react'
import * as THREE from 'three'
import { GRAIN, TILE_M, useWoodMaps } from './wood'

/**
 * The top of a café table, as a surface that has been used.
 *
 * Every table in the building shared one material object with the stools and
 * the window bench — literally the same `MeshStandardMaterial`, the same
 * texture at the same repeat — so four tables, three stools and a bench were
 * all cut from one magic board with the same knot in the same place. That is
 * fine for a bench nobody looks at. It is not fine for the table top, which is
 * 60cm from the seated camera in the opening frame and is the only surface in
 * the building anyone actually touches.
 *
 * Three things had to be true, and only the third is about resolution:
 *
 * **Boards, not a wrapped sheet.** A round top is glued up from boards. Here
 * they are laid out for real, each one taken from a different plank of the
 * source photograph at a different offset, with a seam between. That alone
 * stops the four tops matching.
 *
 * **The middle is polished and the edge is not.** Decades of forearms, plates
 * and wiping take the wax down to a shine in a broad patch in the centre,
 * while the rim stays matte. This is the largest single thing: a table with
 * one roughness across it catches the window identically at every point, which
 * is what "new furniture in an old room" looks like.
 *
 * **Cup rings.** Overlapping, some partial, some faint. Nothing else says
 * "this is a café" as cheaply. They have to be placed on the table rather than
 * in a tiling texture — a repeating cup ring is worse than none — so this
 * bakes one non-tiling map per table instead of tiling one.
 *
 * That costs memory: a bespoke albedo, roughness and normal per table rather
 * than three textures shared by everything. Your own table gets 1024²; the
 * three you only ever see from across the room get 512², which is the whole
 * reason the size is a parameter.
 */

/** Metres of surface covered by one width of the source texture. */
const ALONG = TILE_M / GRAIN.furniture
/** How wide the boards are. */
const BOARD = 0.145
/** The source set is a wall of nine planks. */
const PLANKS = 9

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function surface(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!]
}

/**
 * Which of the source's planks are fit to make a table out of.
 *
 * The set is barn siding, and a couple of its planks are almost black. Picked
 * at random they land next to a pale one and the top comes out looking like a
 * deck rather than a table, because nobody glues a top up out of whatever
 * boards are to hand — they are sorted for colour first, and the ones that do
 * not match go in the frame where they will not be seen. So the darkest two
 * and the lightest one are dropped and the top is made from the middle six.
 */
function sorted(img: CanvasImageSource & { width: number; height: number }): number[] {
  const [, ctx] = surface(64)
  ctx.drawImage(img, 0, 0, 64, 64)
  const d = ctx.getImageData(0, 0, 64, 64).data
  const rows = 64 / PLANKS
  const lum: { band: number; v: number }[] = []
  for (let b = 0; b < PLANKS; b++) {
    let sum = 0
    let n = 0
    for (let y = Math.floor(b * rows); y < Math.floor((b + 1) * rows); y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4
        sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        n++
      }
    }
    lum.push({ band: b, v: n ? sum / n : 0 })
  }
  lum.sort((a, b) => a.v - b.v)
  return lum.slice(2, PLANKS - 1).map((e) => e.band)
}

/** Which plank each board came off, and how far along it was cut. */
type Glueup = { plank: number[]; offset: number[] }

function glueup(rows: number, rand: () => number, pool: number[]): Glueup {
  const plank: number[] = []
  const offset: number[] = []
  let last = -1
  for (let r = 0; r < rows; r++) {
    // Never the same plank twice running, or two boards share a knot along
    // their shared seam and the join stops reading as a join.
    let i = Math.floor(rand() * pool.length)
    if (pool[i] === last) i = (i + 1 + Math.floor(rand() * (pool.length - 1))) % pool.length
    last = pool[i]
    plank.push(pool[i])
    offset.push(rand())
  }
  return { plank, offset }
}

/**
 * Lay one of the source maps out as boards across the top.
 *
 * Called three times with the same glue-up, so the albedo, the roughness and
 * the normal all agree about where the boards are.
 */
function boards(
  img: CanvasImageSource & { width: number; height: number },
  size: number,
  span: number,
  g: Glueup,
): HTMLCanvasElement {
  const [c, ctx] = surface(size)
  const rows = g.plank.length
  const rowPx = size / rows
  const bandPx = img.height / PLANKS
  const alongPx = (ALONG / span) * size

  for (let r = 0; r < rows; r++) {
    const y = r * rowPx
    const start = -g.offset[r] * alongPx
    for (let x = start; x < size; x += alongPx) {
      ctx.drawImage(
        img,
        0,
        g.plank[r] * bandPx,
        img.width,
        bandPx,
        x,
        y,
        // A hair of overlap. Sub-pixel row heights otherwise leave a
        // one-pixel transparent line along every seam, which the renderer
        // shows as a bright hairline.
        alongPx + 1,
        rowPx + 1,
      )
    }
  }
  return c
}

/** The dark line where two boards meet. */
function seams(ctx: CanvasRenderingContext2D, size: number, rows: number, ink: string) {
  ctx.strokeStyle = ink
  ctx.lineWidth = Math.max(1, size / 512)
  for (let r = 1; r < rows; r++) {
    const y = (r * size) / rows
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
  }
}

/**
 * What has happened to the table, in metres.
 *
 * Planned once and stamped twice, at whatever resolution each map happens to
 * be. The first version drew straight into both contexts inside one loop,
 * which looked tidy and was wrong: the albedo is 1024 and the roughness is
 * 512, so every ring landed at double coordinates on the roughness map and
 * the polish covered a quarter of the table from the wrong centre. Nothing in
 * a lit render showed it — a glossy patch and the window reflected in it are
 * the same pixels — and it was only visible by dumping the maps out and
 * looking at them side by side.
 *
 * Rings are pushed outward: people set cups down in front of themselves, at
 * the edge, not in the middle of the table. Some are drawn as partial arcs,
 * because a cup lifted and set down again leaves an interrupted ring far more
 * often than a closed one.
 */
type Ring = { x: number; y: number; r: number; from: number; arc: number; dark: number }
type Scratch = { x: number; y: number; len: number; angle: number; alpha: number }
type Wear = { rings: Ring[]; scratches: Scratch[] }

function plan(span: number, rand: () => number): Wear {
  const rings: Ring[] = []
  const n = 6 + Math.floor(rand() * 7)
  for (let i = 0; i < n; i++) {
    // sqrt keeps them off the centre; a table is used round its rim.
    const d = Math.sqrt(0.15 + rand() * 0.7) * span * 0.42
    const a = rand() * Math.PI * 2
    rings.push({
      x: span / 2 + Math.cos(a) * d,
      y: span / 2 + Math.sin(a) * d,
      r: 0.03 + rand() * 0.019,
      from: rand() * Math.PI * 2,
      arc: rand() < 0.45 ? 1.2 + rand() * 3.4 : Math.PI * 2,
      dark: 0.35 + rand() * 0.45,
    })
  }

  const scratches: Scratch[] = []
  for (let i = 0; i < 26; i++) {
    scratches.push({
      x: rand() * span,
      y: rand() * span,
      len: 0.02 + rand() * 0.12,
      angle: (rand() - 0.5) * (rand() < 0.7 ? 0.35 : Math.PI),
      alpha: 0.05 + rand() * 0.09,
    })
  }
  return { rings, scratches }
}

/** The marks, on the colour map. */
function stain(ctx: CanvasRenderingContext2D, size: number, span: number, w: Wear) {
  const px = (m: number) => (m / span) * size

  for (const g of w.rings) {
    /*
     * Two passes. A cup ring is a dark line with a paler bloom just inside
     * it, because the coffee dries outward and leaves the tannin at the edge
     * — a single stroke reads as a drawn circle, which is what the first
     * attempt looked like, and it was so faint against dark wood that it may
     * as well not have been there.
     */
    ctx.strokeStyle = `rgba(38,20,9,${0.1 * g.dark})`
    ctx.lineWidth = Math.max(3, px(0.009))
    ctx.beginPath()
    ctx.arc(px(g.x), px(g.y), px(g.r - 0.004), g.from, g.from + g.arc)
    ctx.stroke()

    ctx.strokeStyle = `rgba(28,13,5,${0.34 * g.dark})`
    ctx.lineWidth = Math.max(1.5, px(0.0026))
    ctx.beginPath()
    ctx.arc(px(g.x), px(g.y), px(g.r), g.from, g.from + g.arc)
    ctx.stroke()
  }

  // Scratches through the wax. Short, shallow, mostly with the grain.
  ctx.lineWidth = 1
  for (const s of w.scratches) {
    ctx.strokeStyle = `rgba(226,206,170,${s.alpha})`
    ctx.beginPath()
    ctx.moveTo(px(s.x), px(s.y))
    ctx.lineTo(px(s.x + Math.cos(s.angle) * s.len), px(s.y + Math.sin(s.angle) * s.len))
    ctx.stroke()
  }
}

/**
 * The polish, and the marks that resist it, on the roughness map.
 *
 * The polish multiplies rather than replaces, so the grain the photograph
 * supplied still modulates the shine — it just shines more in the middle,
 * where decades of forearms and plates and wiping have taken the wax down.
 * This is the largest single thing in the file: one roughness across a table
 * catches the window identically at every point, which is exactly what new
 * furniture in an old room looks like.
 */
function dull(ctx: CanvasRenderingContext2D, size: number, span: number, w: Wear) {
  const px = (m: number) => (m / span) * size
  const mid = size / 2

  ctx.globalCompositeOperation = 'multiply'
  const p = ctx.createRadialGradient(mid, mid, 0, mid, mid, size * 0.5)
  p.addColorStop(0, 'rgba(148,148,148,1)')
  p.addColorStop(0.5, 'rgba(196,196,196,1)')
  p.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = p
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = 'source-over'

  // A dried ring is matte, so it lifts the roughness back out of the polish.
  for (const g of w.rings) {
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * g.dark})`
    ctx.lineWidth = Math.max(2, px(0.006))
    ctx.beginPath()
    ctx.arc(px(g.x), px(g.y), px(g.r), g.from, g.from + g.arc)
    ctx.stroke()
  }
}

type Sources = {
  map: CanvasImageSource & { width: number; height: number }
  roughnessMap: CanvasImageSource & { width: number; height: number }
  normalMap: CanvasImageSource & { width: number; height: number }
}

/**
 * The three canvases for one table, without any of three.js around them.
 *
 * Split out from the hook so the maps can be built and looked at directly —
 * a wear pass is impossible to judge from a lit render, where a glossy patch
 * in the middle of the table and the window reflected off it are the same
 * handful of pixels.
 */
export function tableTopMaps(
  src: Sources,
  seed: number,
  radius: number,
  size: number,
): [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] {
  const span = radius * 2
  const rand = seeded(seed * 7919 + 13)
  const rows = Math.max(4, Math.round(span / BOARD))
  const g = glueup(rows, rand, sorted(src.map))

  const half = Math.max(256, size / 2)
  const albedoC = boards(src.map, size, span, g)
  const roughC = boards(src.roughnessMap, half, span, g)
  const normalC = boards(src.normalMap, half, span, g)

  const w = plan(span, rand)
  seams(albedoC.getContext('2d')!, size, rows, 'rgba(26,17,10,0.55)')
  stain(albedoC.getContext('2d')!, size, span, w)
  dull(roughC.getContext('2d')!, half, span, w)
  return [albedoC, roughC, normalC]
}

export function useTableTop(seed: number, radius: number, size = 512) {
  const maps = useWoodMaps(1)

  return useMemo(() => {
    // useTexture has suspended until these decoded, so .image is an <img>.
    const img = (t: THREE.Texture) => t.image as HTMLImageElement
    const [albedoC, roughC, normalC] = tableTopMaps(
      { map: img(maps.map), roughnessMap: img(maps.roughnessMap), normalMap: img(maps.normalMap) },
      seed,
      radius,
      size,
    )

    const map = new THREE.CanvasTexture(albedoC)
    map.colorSpace = THREE.SRGBColorSpace
    const roughnessMap = new THREE.CanvasTexture(roughC)
    const normalMap = new THREE.CanvasTexture(normalC)
    for (const t of [map, roughnessMap, normalMap]) {
      t.anisotropy = 8
      // One map, one table. Nothing here repeats, which is the point.
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    }
    for (const t of [roughnessMap, normalMap]) t.colorSpace = THREE.NoColorSpace

    return new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      normalMap,
      // Matches the tint the rest of the furniture carries, so the top and
      // the pedestal under it stay the same timber.
      color: new THREE.Color('#bda06f'),
      roughness: 0.72,
      metalness: 0,
      normalScale: new THREE.Vector2(0.7, 0.7),
    })
  }, [maps, seed, radius, size])
}
