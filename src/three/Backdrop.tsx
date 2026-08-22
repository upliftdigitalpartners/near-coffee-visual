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

/*
 * Very nearly white, and that is a correction rather than a preference.
 *
 * This used to be a mid grey-blue sampled off the photograph's snowfield, and
 * it double-darkened: the canvas below is already painted the colour of snow,
 * so tinting it again landed the modelled ground about 25% darker than the
 * photographed ground it runs into. Measured across the doorway at dusk, the
 * plate's snow came back at 166 and the floor of the valley at 125 — the near
 * ground darker than the far ground, which is backwards, and reads as a shadow
 * lying across the foreground that nothing in the scene is casting.
 *
 * The canvas carries the colour and the grade carries the light. This carries
 * neither, and only keeps a trace of blue.
 */
const SNOW = new THREE.Color('#fbfcfd')

/*
 * Where the modelled ground stops being the ground.
 *
 * The valley floor and the photograph cannot meet cleanly, and no amount of
 * sizing fixes it. The plane's far rim is cut off where the backdrop cylinder
 * occludes it — 62m out — and at eye height that rim sits 1.4 degrees below
 * true horizon. The photograph's own horizon is at eye level, by construction.
 * So a strip of the photograph's foreground, the sage and scrub in front of
 * the range, is always left standing *above* the modelled snow, with a hard
 * edge between them. That edge is what reads as a stage flat.
 *
 * It is unfixable as a join and trivial as a dissolve: the plane simply fades
 * out over its last thirty metres and lets the photograph's own foreground
 * carry the distance. There is no seam because there is no longer an edge, and
 * what takes over is a real photograph of the right ground rather than a
 * procedural approximation of it.
 */
const GROUND_SOLID_TO = 24
const GROUND_GONE_BY = 54

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

  /*
   * The declarations and the grade itself, so the plate and the ground can run
   * the identical maths off the identical uniforms. They used to be graded by
   * two different functions — the plate through this shader, the ground
   * through a colour multiply — which is why at dusk the modelled snow stayed
   * a cold pale blue while the photographed snow it had to sit against went
   * warm. Two snowfields under two different suns, touching.
   */
  const GRADE_UNIFORMS = `
    uniform float uExposure;
    uniform float uSaturation;
    uniform vec3  uTint;
    uniform float uTintAmount;
    uniform float uLift;`

  const GRADE_BODY = `
    {
      vec3 c = diffuseColor.rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c = mix(c, uTint * l, uTintAmount);
      diffuseColor.rgb = c * uExposure + uLift;
    }`

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
        .replace('#include <common>', `#include <common>\n${GRADE_UNIFORMS}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${GRADE_BODY}`)
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  /*
   * The valley floor: same grade, plus the dissolve into the photograph.
   *
   * Distance is taken in world space rather than from the disc's UVs, because
   * the snow texture is tiled 110 times across it and vMapUv is therefore
   * meaningless as a radius.
   */
  const groundMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: ground,
      color: SNOW,
      toneMapped: false,
      // Matches the plate, which is also unfogged. Fogging one and not the
      // other reintroduces the mismatch this whole dissolve exists to remove.
      fog: false,
      transparent: true,
      // The photograph behind it is already in the depth buffer at 62m; the
      // barn in front of it is opaque and drawn first. Writing depth here only
      // lets the snow outside occlude the falling snow in front of it.
      depthWrite: false,
    })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, grade.current)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
           vGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec2 vGroundXZ;
           ${GRADE_UNIFORMS}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           ${GRADE_BODY}
           diffuseColor.a *= 1.0 - smoothstep(${GROUND_SOLID_TO.toFixed(1)}, ${GROUND_GONE_BY.toFixed(1)}, length(vGroundXZ));`,
        )
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground])

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
    /*
     * noShafts keeps the whole backdrop out of the sun-depth pass in
     * Shafts.tsx. The cylinder is 62m across and the sun stands outside it, so
     * in a depth-from-sun render it covers the barn completely and the entire
     * interior comes back in shadow.
     */
    <group userData={{ noShafts: true }}>
      {/*
       * Unlit on purpose. It is a photograph of a mountain range ten miles
       * off; lighting it would be lighting a picture of light.
       */}
      <mesh geometry={geometry} position={[0, CENTRE_Y, 0]} material={plate} />

      {/*
       * Valley floor. Graded by the same uniforms as the plate above, and
       * dissolved into it rather than butted against it — see GROUND_GONE_BY.
       *
       * It stays much larger than the cylinder even though its far half is now
       * transparent: the disc has to reach past the cylinder in every
       * direction, or the dissolve runs out before the horizon does and the
       * rim comes back as an edge somewhere off to the side of the doorway.
       */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        material={groundMat}
        renderOrder={-1}
      >
        <circleGeometry args={[RADIUS * 5, 96]} />
      </mesh>
    </group>
  )
}
