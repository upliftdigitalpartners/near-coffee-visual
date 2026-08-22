import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { SceneLight } from './lighting'

/**
 * The view out the door.
 *
 * A real photograph of the Teton range wrapped onto a cylinder centred on the
 * barn, so it stays correct as the camera pans instead of shearing the way a
 * flat billboard would.
 *
 * Photograph: "Teton Range Panorama Spring", National Park Service, public
 * domain, via Wikimedia Commons. NPS work is a work of the US government and
 * therefore uncopyrighted — which is the reason it is this image and not a
 * nicer one off a stock site.
 *
 * The left quarter of the frame has a ploughed road and a parked car in it.
 * Rather than re-cut the file, the UVs simply start past them, so the original
 * download stays pristine and the crop is one number you can change.
 */

const ROAD_CROP = 0.26

const RADIUS = 62

/*
 * Height and centre are not free parameters — they are solved.
 *
 * The valley floor outside is a flat plane, so its horizon sits exactly at eye
 * level. If the horizon *inside the photograph* lands anywhere else, the plane
 * cuts across the picture and you get a flat band of ground sitting in front
 * of a snowfield that is still visible above it. It reads as a painted flat,
 * which is precisely what you are trying to hide.
 *
 * The far horizon in this frame is about 80% of the way down the image. On a
 * cylinder, v runs 0 at the bottom edge to 1 at the top, so that line sits at
 * v = 0.2, i.e. at centreY - 0.3 * height. Setting that equal to eye level
 * fixes the centre. HEIGHT then just sets how big the range looks: 26m puts
 * the summits about 16° up, against roughly 11° for the real thing from
 * Mormon Row — a little heroic, but this is a coffee shop, not a survey.
 */
const EYE_LEVEL = 1.22
const HORIZON_V = 0.2

/** World height the photograph itself covers. Sets how big the range looks. */
const PHOTO_BAND = 26
const PHOTO_BOTTOM_Y = EYE_LEVEL - HORIZON_V * PHOTO_BAND

/*
 * The cylinder is far taller than the photograph, and that is the whole point.
 * Sized to the photograph, its top edge sits about 18° up — well inside a 46°
 * field of view — so walking to the door reveals a hard horizontal seam with
 * background colour above it, like the top of a stage flat.
 *
 * Instead the cylinder runs up to 70m and the texture is scaled to occupy only
 * the lower band. Everything above samples past v = 1, and because the wrap
 * mode is clamp-to-edge, that smears the photograph's topmost row — which is
 * open sky — all the way up. Free sky, exactly matched to the plate.
 */
const HEIGHT = 74
const CENTRE_Y = PHOTO_BOTTOM_Y + HEIGHT / 2

/** Wide enough that panning never runs off the end of the photograph. */
const ARC = THREE.MathUtils.degToRad(170)

/** Sampled off the snowfield in the lower third of the photograph. */
const SNOW = new THREE.Color('#bfc8d1')

/**
 * Late-spring snowfield for the ground outside the door.
 *
 * A flat colour here is the giveaway: the doorway shows a wedge of ground
 * between the threshold and the horizon, and against a photograph it reads
 * instantly as paint. Crusted snow with sage and bare ground breaking through
 * gives the eye something to land on, and matches what is happening in the
 * lower third of the photograph it has to sit against.
 */
function snowTexture(): THREE.CanvasTexture {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!

  let seed = 4242
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  ctx.fillStyle = '#e4e9ee'
  ctx.fillRect(0, 0, S, S)

  // Soft drifts and hollows.
  for (let i = 0; i < 220; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 30 + rand() * 190
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const dark = rand() > 0.5
    g.addColorStop(0, dark ? 'rgba(150,164,180,0.16)' : 'rgba(255,255,255,0.2)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Sage and bare ground pushing through the crust. Small and low-contrast:
  // bigger or bolder and the field reads as puddles rather than snow.
  for (let i = 0; i < 420; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 2 + rand() * 9
    ctx.fillStyle = `rgba(${78 + rand() * 44},${70 + rand() * 38},${50 + rand() * 30},${0.12 + rand() * 0.3})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Fine crust grain, so it never reads as a flat fill up close.
  for (let i = 0; i < 5200; i++) {
    const v = rand()
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${rand() * 0.3})` : `rgba(146,158,172,${rand() * 0.22})`
    ctx.fillRect(rand() * S, rand() * S, 1 + rand() * 2, 1 + rand() * 2)
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(110, 110)
  t.anisotropy = 8
  return t
}

export function Backdrop({ light }: { light: SceneLight }) {
  // BASE_URL, not a leading slash: an absolute path 404s the moment this is
  // served from anywhere but the domain root, and the barn loses its view.
  const texture = useTexture(`${import.meta.env.BASE_URL}textures/teton-range.jpg`)

  const map = useMemo(() => {
    const t = texture.clone()
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    t.offset.set(ROAD_CROP, 0)
    t.repeat.set(1 - ROAD_CROP, HEIGHT / PHOTO_BAND)
    t.needsUpdate = true
    return t
  }, [texture])

  const ground = useMemo(snowTexture, [])

  /*
   * The plate, graded in the shader rather than tinted.
   *
   * A colour multiply can only ever darken; it cannot desaturate a blue sky
   * toward dusk or push midday light warm. This injects a small grade after
   * the texture is sampled — exposure, saturation, and a lean toward whatever
   * colour the sun currently is — which is what actually lets a bright noon
   * photograph sit inside a dim evening room without looking pasted in.
   */
  const grade = useRef({
    uExposure: { value: 1 },
    uSaturation: { value: 1 },
    uTint: { value: new THREE.Color('#ffffff') },
    uTintAmount: { value: 0 },
    uLift: { value: 0 },
  })

  const plate = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
    })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, grade.current)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uExposure;
           uniform float uSaturation;
           uniform vec3  uTint;
           uniform float uTintAmount;
           uniform float uLift;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           {
             vec3 c = diffuseColor.rgb;
             float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
             c = mix(vec3(l), c, uSaturation);
             c = mix(c, uTint * l, uTintAmount);
             diffuseColor.rgb = c * uExposure + uLift;
           }`,
        )
    }
    return m
  }, [map])

  // Push the grade every frame; the day moves and so does the plate.
  useFrame(() => {
    const g = light.backdropGrade
    grade.current.uExposure.value = g.exposure
    grade.current.uSaturation.value = g.saturation
    grade.current.uTint.value.copy(g.tint)
    grade.current.uTintAmount.value = g.tintAmount
    grade.current.uLift.value = g.lift
  })

  const geometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        RADIUS,
        RADIUS,
        HEIGHT,
        96,
        1,
        true,
        Math.PI - ARC / 2,
        ARC,
      ),
    [],
  )

  return (
    <group>
      {/*
       * Unlit on purpose. It is a photograph of a mountain range ten miles
       * off; lighting it would be lighting a picture of light.
       */}
      <mesh geometry={geometry} position={[0, CENTRE_Y, 0]} material={plate} />

      {/*
       * Valley floor, running out to meet the bottom of the photograph. Unlit
       * and tinted by exactly the same factor as the backdrop, so the seam at
       * the horizon falls between two identically exposed snowfields instead
       * of between a lit surface and a photograph of one.
       */}
      {/*
       * Far larger than the backdrop cylinder, and that matters. A disc the
       * same radius as the cylinder ends *above* eye level — the rim of a
       * finite plane always does — so its edge shows up as a hard grey band
       * across the bottom of the doorway with the photographed snowfield
       * still visible above it. Oversizing it puts the rim behind the
       * cylinder, where it is occluded, and the two meet exactly on the
       * cylinder's base circle: snow against snow, no seam.
       */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[RADIUS * 5, 96]} />
        <meshBasicMaterial
          map={ground}
          color={SNOW.clone().multiply(light.backdropTint)}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
