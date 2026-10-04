import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { present } from '../optional'

/**
 * What is burning, as a texture.
 *
 * Both fires in the building — the stove's mica window and the oven's mouth —
 * were an emissive colour with a sine on its intensity. That is a lit
 * rectangle that breathes, and a lit rectangle is the shape of a screen.
 *
 * This gives them a map instead: a bed of coals along the floor of the
 * chamber, falling off into a dark arch, with a few embers sitting brighter
 * than the rest. And if a looping clip of real flame is dropped into
 * `public/video/fire.mp4`, it swaps itself in — which is the one thing worth
 * filming here, because fire is the single surface in the building whose
 * *motion* is its whole character, and no amount of profile points or noise
 * octaves gets you there.
 *
 * The drawn version is not a placeholder to be deleted. It is what everyone
 * sees before the video has buffered, everyone whose browser refuses to
 * autoplay, and everyone the clip never reaches. It has to stand on its own,
 * so it does.
 *
 * One texture, shared. The stove is in the barn and the oven is through the
 * back wall, so the two are near enough never both prominent, and a second
 * decode to put them out of step with each other is not worth the frame.
 */

const CLIP = `${import.meta.env.BASE_URL}video/fire.mp4`

function drawn(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#160804'
  ctx.fillRect(0, 0, 128, 64)

  // The bed of coals, along the floor of the chamber.
  const bed = ctx.createLinearGradient(0, 64, 0, 8)
  bed.addColorStop(0, 'rgba(255,236,190,1)')
  bed.addColorStop(0.22, 'rgba(255,150,60,0.95)')
  bed.addColorStop(0.6, 'rgba(150,50,14,0.5)')
  bed.addColorStop(1, 'rgba(20,8,4,0)')
  ctx.fillStyle = bed
  ctx.fillRect(0, 0, 128, 64)

  // Darker into the corners: the throat of the arch is never this bright.
  const vign = ctx.createRadialGradient(64, 52, 6, 64, 46, 84)
  vign.addColorStop(0, 'rgba(0,0,0,0)')
  vign.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = vign
  ctx.fillRect(0, 0, 128, 64)

  // A few embers sitting brighter than the rest.
  let s = 99
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
  for (let i = 0; i < 22; i++) {
    const x = 14 + rand() * 100
    const y = 42 + rand() * 20
    const r = 2 + rand() * 7
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,240,205,${0.5 + rand() * 0.5})`)
    g.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Resolved once per page, not once per fire.
 *
 * Null until something has asked, then either a VideoTexture or `false` for
 * "there is no clip, stop looking". The file is expected to be missing — it
 * is optional by design — so the probe runs first rather than letting a video
 * element fail, and it checks the content type rather than the status. See
 * `present` in src/optional.ts for why that distinction is not pedantry.
 */
let pending: Promise<THREE.VideoTexture | false> | null = null

function clip(): Promise<THREE.VideoTexture | false> {
  if (pending) return pending
  pending = (async () => {
    if (!(await present(CLIP, 'video'))) return false

    const v = document.createElement('video')
    v.src = CLIP
    v.loop = true
    v.playsInline = true
    // Muted is not a style choice. Autoplay without it is refused everywhere,
    // and a fire that only lights once someone taps is worse than a drawn one.
    v.muted = true
    v.preload = 'auto'

    const ready = await new Promise<boolean>((resolve) => {
      const ok = () => resolve(true)
      const no = () => resolve(false)
      v.addEventListener('canplay', ok, { once: true })
      v.addEventListener('error', no, { once: true })
      // Some browsers will sit on `loading` forever behind a data saver.
      setTimeout(no, 8000)
    })
    if (!ready) return false

    try {
      await v.play()
    } catch {
      return false
    }

    const t = new THREE.VideoTexture(v)
    t.colorSpace = THREE.SRGBColorSpace
    // A video texture is re-uploaded every frame; mipmaps would be rebuilt
    // every frame with it, for a plane that is never minified.
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    t.generateMipmaps = false
    return t
  })()
  return pending
}

/** The drawn fire now, and the filmed one as soon as there is one. */
export function useFire(): THREE.Texture {
  const fallback = useMemo(drawn, [])
  const [tex, setTex] = useState<THREE.Texture>(fallback)

  useEffect(() => {
    let live = true
    clip().then((t) => {
      if (live && t) setTex(t)
    })
    return () => {
      live = false
    }
  }, [])

  return tex
}
