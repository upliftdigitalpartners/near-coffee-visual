import { useMemo } from 'react'
import * as THREE from 'three'
import { type WoodMaps, useWoodMaps } from './wood'

/**
 * Timber with something on top of it.
 *
 * The bakery's walls are described in the code as limewashed and its material
 * carries the tint `#efe9dc` to say so. They render as barn timber. The
 * porch deck is described as silvered and tinted `#b9b3a8`. It renders almost
 * black — darker, at midday, than the floor inside the building.
 *
 * Both for the same reason, and it is worth stating flatly because it caps
 * what a tint can ever do: **`color` on a MeshStandardMaterial multiplies the
 * albedo map, and multiplication cannot lighten.** The Poly Haven set is dark
 * timber; the palest thing in it sits around 0.35, so no tint short of a value
 * above 1 will get a wall to read as white. Limewash is not a tint on wood. It
 * is a coating that sits on the wood and hides most of it, and weathered
 * decking is not dark wood tinted grey — the surface is genuinely, physically
 * pale, because a century of ultraviolet has bleached the lignin out of it.
 *
 * So these composite a coat over the photograph in a canvas, the same way
 * tabletop.ts lays boards, and keep the source's normal and roughness so the
 * grain still reads as relief. The albedo stays pixel-registered with the
 * original, which matters: the barn and the bakery map each board into one
 * plank band of the source through `plankUVs`, and that only works if the
 * coats have not moved anything.
 */

const SIZE = 1024

function surface(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
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
 * Pull an image toward a pale colour, per pixel.
 *
 * `desaturate` takes the chroma out and `lift` raises the level toward
 * `toward`. Done on the pixels rather than by drawing a translucent rectangle
 * over the top, because a flat overlay lifts the dark grain and the light
 * grain by the same amount and flattens the contrast to nothing — the wall
 * goes pale and also goes blank, which is worse than leaving it brown. This
 * keeps the *relative* variation and moves the whole range.
 */
function bleach(
  ctx: CanvasRenderingContext2D,
  size: number,
  desaturate: number,
  lift: number,
  toward: [number, number, number],
) {
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    for (let k = 0; k < 3; k++) {
      const grey = d[i + k] + (lum - d[i + k]) * desaturate
      d[i + k] = grey + (toward[k] - grey) * lift
    }
  }
  ctx.putImageData(img, 0, 0)
}

function coat(albedo: HTMLCanvasElement, maps: WoodMaps, normalScale: number, roughness: number) {
  const map = new THREE.CanvasTexture(albedo)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.copy(maps.map.repeat)
  map.anisotropy = 8
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: maps.normalMap,
    roughnessMap: maps.roughnessMap,
    aoMap: maps.aoMap,
    roughness,
    metalness: 0,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    side: THREE.DoubleSide,
  })
}

/**
 * Limewash, for the bakery.
 *
 * Every bakery that has ever passed an inspection has white walls: limewash
 * is cheap, mildly antiseptic, and throws light around a room with one small
 * window. It is also brushed on rather than sprayed, so it goes on unevenly —
 * thin over the raised grain, pooled in the hollows, and thinner still where
 * anyone has leaned or brushed past it for years. Those streaks are the whole
 * difference between limewash and white paint.
 */
export function useLimewash(grain: number) {
  const maps = useWoodMaps(grain)
  return useMemo(() => {
    const [c, ctx] = surface(SIZE)
    const rand = seeded(1848)
    ctx.drawImage(maps.map.image as HTMLImageElement, 0, 0, SIZE, SIZE)
    // Warm, and short of opaque. A wash that covers completely is paint.
    bleach(ctx, SIZE, 0.7, 0.64, [242, 236, 221])

    /*
     * Brush work. Long and horizontal, because the source set is a wall of
     * horizontal planks and nobody brushes across the grain if they can help
     * it.
     */
    ctx.lineCap = 'round'
    for (let i = 0; i < 90; i++) {
      const y = rand() * SIZE
      const x = rand() * SIZE
      const len = SIZE * (0.1 + rand() * 0.55)
      ctx.strokeStyle = `rgba(255,253,247,${0.05 + rand() * 0.12})`
      ctx.lineWidth = 3 + rand() * 16
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y + (rand() - 0.5) * 10)
      ctx.stroke()
    }
    // And where it went on thin, the board comes back through.
    for (let i = 0; i < 34; i++) {
      const y = rand() * SIZE
      const x = rand() * SIZE
      const len = SIZE * (0.06 + rand() * 0.3)
      ctx.strokeStyle = `rgba(150,126,96,${0.04 + rand() * 0.1})`
      ctx.lineWidth = 2 + rand() * 9
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y + (rand() - 0.5) * 8)
      ctx.stroke()
    }

    // Limewash fills the grain rather than following it, so the relief drops.
    return coat(c, maps, 0.55, 0.95)
  }, [maps])
}

/**
 * Silvered timber, for the porch.
 *
 * Decking outdoors goes pale, not dark. Ultraviolet breaks down the lignin
 * that holds the colour and rain washes it out, and what is left is the grey
 * cellulose — so weathered boards are *lighter* than the same boards indoors,
 * which is the opposite of what "a century of weather" makes you reach for.
 * At midday the porch was rendering darker than the room behind it, and a
 * deck in full snow-bounce being the darkest thing in the frame is the sort
 * of wrongness nobody can name and everybody sees.
 *
 * The splits are the other half. Flat-laid boards check along the grain as
 * they take water and dry out, over and over, and those dark lines are most
 * of what says decking rather than floor.
 */
export function useSilvered(grain: number, lift = 0.46) {
  const maps = useWoodMaps(grain)
  return useMemo(() => {
    const [c, ctx] = surface(SIZE)
    const rand = seeded(7373)
    ctx.drawImage(maps.map.image as HTMLImageElement, 0, 0, SIZE, SIZE)
    /*
     * Not all the way, and not to a neutral grey. The first pass went to 0.88
     * desaturation and 0.66 lift toward a cool grey, and the deck came back
     * flat lilac — it read as painted concrete, because taking out the chroma
     * and most of the contrast leaves nothing for the grain to be. Silvered
     * timber still has tonal range; it has just lost its colour.
     */
    bleach(ctx, SIZE, 0.7, lift, [178, 173, 164])

    // Checks along the grain.
    ctx.lineCap = 'butt'
    for (let i = 0; i < 120; i++) {
      const y = rand() * SIZE
      const x = rand() * SIZE
      const len = SIZE * (0.03 + rand() * 0.22)
      ctx.strokeStyle = `rgba(74,68,60,${0.1 + rand() * 0.3})`
      ctx.lineWidth = rand() < 0.75 ? 1 : 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y + (rand() - 0.5) * 3)
      ctx.stroke()
    }
    // Grey patches where it stays damp longest.
    for (let i = 0; i < 40; i++) {
      const x = rand() * SIZE
      const y = rand() * SIZE
      const r = 20 + rand() * 90
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const dark = rand() > 0.55
      g.addColorStop(0, dark ? 'rgba(96,94,88,0.2)' : 'rgba(226,224,216,0.22)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Weathered timber is rough all over; nothing out here is ever polished.
    return coat(c, maps, 1.25, 1)
  }, [maps, lift])
}
