import * as THREE from 'three'

/**
 * Weathered barn board, generated onto a canvas rather than downloaded.
 *
 * A photograph of real siding would be sharper, but it would also be one fixed
 * board repeated across the whole structure, and the eye picks that up fast.
 * Generating it means every plank can have its own grain, its own knots and
 * its own weathering, which is what actually sells a wall of hundred-year-old
 * timber — the variation, not the resolution.
 *
 * Mormon Row siding is silvered and grey-brown where the sun has had it, with
 * the original warmer wood still showing in the sheltered grain.
 */

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const W = 128
const H = 1024

/** One board, grain running the long way. */
function drawBoard(ctx: CanvasRenderingContext2D, seed: number) {
  const rand = rng(seed)

  /*
   * Base tone. Barn siding that has stood on Mormon Row for a century is
   * silver-grey, not brown — the lignin at the surface has gone and taken the
   * colour with it, leaving warmth only deep in the grain. Keeping the
   * saturation up here is what makes a build like this read as new cedar
   * cladding on a rich person's cabin instead of a homestead barn.
   */
  const warmth = rand()
  const base = `hsl(${26 + warmth * 14}, ${3 + warmth * 6}%, ${28 + rand() * 14}%)`
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Grain: long vertical fibres that wander slightly.
  const lines = 90 + Math.floor(rand() * 70)
  for (let i = 0; i < lines; i++) {
    const x = rand() * W
    const light = rand() > 0.5
    ctx.strokeStyle = light
      ? `rgba(196,192,183,${0.05 + rand() * 0.14})`
      : `rgba(20,17,14,${0.07 + rand() * 0.2})`
    ctx.lineWidth = 0.4 + rand() * 2.2
    ctx.beginPath()
    let y = 0
    let cx = x
    ctx.moveTo(cx, y)
    while (y < H) {
      y += 24 + rand() * 46
      cx += (rand() - 0.5) * 5
      ctx.lineTo(cx, y)
    }
    ctx.stroke()
  }

  // Knots. A board without one looks manufactured.
  const knots = Math.floor(rand() * 3)
  for (let k = 0; k < knots; k++) {
    const kx = 14 + rand() * (W - 28)
    const ky = rand() * H
    const kr = 5 + rand() * 9
    for (let r = kr * 2.6; r > 0; r -= 1.3) {
      ctx.strokeStyle = `rgba(20,14,10,${0.05 + (1 - r / (kr * 2.6)) * 0.4})`
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.ellipse(kx, ky, r * 0.55, r, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = 'rgba(16,11,8,0.75)'
    ctx.beginPath()
    ctx.ellipse(kx, ky, kr * 0.3, kr * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Weathering: rain streaks and sun-bleached patches.
  for (let i = 0; i < 42; i++) {
    const x = rand() * W
    const y = rand() * H
    const h = 40 + rand() * 260
    const g = ctx.createLinearGradient(0, y, 0, y + h)
    const bleach = rand() > 0.45
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(
      0.5,
      bleach ? `rgba(206,204,197,${0.05 + rand() * 0.13})` : `rgba(15,13,11,${0.06 + rand() * 0.15})`,
    )
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, 6 + rand() * 26, h)
  }

  // Split ends and edge wear.
  ctx.strokeStyle = 'rgba(12,8,6,0.5)'
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 0.7 + rand() * 1.4
    const x = rand() * W
    const y0 = rand() > 0.5 ? 0 : H
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x + (rand() - 0.5) * 8, y0 + (y0 === 0 ? 1 : -1) * (20 + rand() * 90))
    ctx.stroke()
  }

  // Darken the long edges so adjoining boards read as separate pieces.
  const edge = ctx.createLinearGradient(0, 0, W, 0)
  edge.addColorStop(0, 'rgba(0,0,0,0.5)')
  edge.addColorStop(0.12, 'rgba(0,0,0,0)')
  edge.addColorStop(0.88, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, W, H)
}

/**
 * An atlas of distinct boards side by side. Meshes pick a column by UV offset,
 * so one texture and one material still gives a wall where no two boards match.
 */
export const BOARD_VARIANTS = 8

let cached: { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } | null = null

export function woodTextures() {
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = W * BOARD_VARIANTS
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  for (let i = 0; i < BOARD_VARIANTS; i++) {
    ctx.save()
    ctx.translate(i * W, 0)
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.clip()
    drawBoard(ctx, 9001 + i * 7919)
    ctx.restore()
  }

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.anisotropy = 8

  /*
   * Roughness derived from the same canvas. Weathered timber is almost
   * entirely matte, so this is a narrow band near the top of the range —
   * the point is only that the grain catches light unevenly.
   */
  const rc = document.createElement('canvas')
  rc.width = canvas.width
  rc.height = canvas.height
  const rctx = rc.getContext('2d')!
  rctx.drawImage(canvas, 0, 0)
  rctx.globalCompositeOperation = 'saturation'
  rctx.fillStyle = '#808080'
  rctx.fillRect(0, 0, rc.width, rc.height)
  rctx.globalCompositeOperation = 'source-over'
  rctx.fillStyle = 'rgba(255,255,255,0.55)'
  rctx.fillRect(0, 0, rc.width, rc.height)

  const rough = new THREE.CanvasTexture(rc)
  rough.wrapS = THREE.RepeatWrapping
  rough.wrapT = THREE.RepeatWrapping

  cached = { map, rough }
  return cached
}

/** UV offset that selects one board out of the atlas. */
export function boardUV(index: number): { offsetX: number; repeatX: number } {
  return {
    offsetX: (index % BOARD_VARIANTS) / BOARD_VARIANTS,
    repeatX: 1 / BOARD_VARIANTS,
  }
}
