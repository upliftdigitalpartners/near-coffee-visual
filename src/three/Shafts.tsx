import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import * as THREE from 'three'
import type { SceneLight } from './lighting'
import { BARN } from './Barn'

/**
 * The light itself, not just what it lands on.
 *
 * The siding is built from separate boards with real gaps, so the sun already
 * throws stripes across the floor. What was missing is the part in between —
 * the blades of lit air standing between the wall and the floor. In a dusty
 * barn at low sun that is most of what you actually see.
 *
 * The design handoff is explicit that the cheap way does not work, and it is
 * right:
 *
 *   "No additive volumetric light shafts. A solid additive volume always
 *    leaves a hard seam where it intersects furniture; a depth-based soft
 *    particle fade is not sufficient because the beam's back face is
 *    depth-culled. Correct god rays need ray-marching."
 *
 * So this ray-marches. For every pixel it walks the view ray from the camera
 * to whatever the depth buffer says is there, asks whether each point along
 * the way can see the sun, and integrates what scatters back toward the eye.
 * Because the march *ends* at the depth buffer, a shaft crossing the counter
 * is occluded by the counter for free — there is no volume to intersect and
 * therefore no seam. That is the whole reason to pay for the marching.
 *
 * ## Why this renders its own depth-from-sun rather than reading the shadow map
 *
 * The obvious implementation samples the sun's existing shadow map. It does
 * not work here, and the failure is worth recording because it is silent:
 * every point in the barn reports itself lit and the room fills with even haze
 * instead of shafts, which looks like a badly tuned effect rather than a
 * broken read.
 *
 * Under three r185 with the default PCFShadowMap, `light.shadow.map` carries
 * two textures. The RGBA colour attachment — the packed-depth target that
 * older code reads with unpackRGBAToDepth — is a dummy that is never written,
 * and returns a cleared 1.0 for every texel. The real depth lives in
 * `map.depthTexture`, a DepthTexture with `compareFunction` set to
 * LessEqualCompare, which makes it a sampler2DShadow read through the hardware
 * comparison unit.
 *
 * Binding that into a postprocessing effect compiled and ran without error and
 * returned results unrelated to the scene. Effect texture uniforms bind
 * correctly in general — checked by pushing a checkerboard through the same
 * uniform and getting a clean checkerboard back — so this is something narrow
 * about a comparison-mode render-target depth attachment sampled from outside
 * the material that owns it. It may well work on other drivers. It could not
 * be made to work on the one available to verify against, and an effect that
 * might be right is worth less than one that is demonstrably right.
 *
 * So the sun's occlusion is rendered here, into an ordinary RGBA8 target with
 * three's own depth packing and no comparison mode — nothing exotic in the
 * format at all. It costs one extra depth-only pass over the barn.
 *
 * ## Two other things that are load-bearing
 *
 * Every ray starts at a dithered offset. Marching all pixels from the same
 * place puts the step boundaries in the same screen positions and lays
 * concentric bands across the image — the same banding that already cost this
 * project GTAO. The dither trades it for fine noise, which reads as dust.
 *
 * Scattering is confined to the inside of the barn. The air outside is a
 * photograph, and hazing it washes the range out and puts a bright wedge in
 * the doorway that no geometry accounts for.
 */

const STEPS = 40

/** Half-width of the sun's view of the barn, in metres. */
const SUN_EXTENT = 9
const SUN_MAP = 2048

/**
 * Objects that must not occlude the sun, tagged with `userData.noShafts`.
 *
 * The backdrop is the one that matters: its cylinder is 62m across and the sun
 * is outside it, so in a depth pass it covers the barn completely and the
 * interior goes uniformly black. Falling snow is excluded for a subtler
 * reason — it drifts between the sun and the barn, and every flake would
 * flicker a shadow through the room.
 */
function veiled(scene: THREE.Scene): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  scene.traverse((o) => {
    if (o.userData?.noShafts) out.push(o)
  })
  return out
}

const fragmentShader = /* glsl */ `
uniform sampler2D uSunDepth;
uniform mat4  uSunMatrix;
uniform mat4  uInverseProjection;
uniform mat4  uCameraMatrixWorld;
uniform vec3  uCameraPos;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uIntensity;
uniform float uNear;
uniform float uFar;
uniform float uMaxDistance;
uniform vec3  uBoxMin;
uniform vec3  uBoxMax;

/*
 * three.js packs depth across RGBA, and these are its constants verbatim from
 * src/renderers/shaders/ShaderChunk/packing.glsl.js. The dot product has to
 * match the packing exactly, or the comparison is against a wrong depth and
 * the room fills with light in the shape of nothing.
 */
const float ShaftUnpackDownscale = 255.0 / 256.0;
const vec4  ShaftPackFactors = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);
const vec4  ShaftUnpackFactors = vec4(
  ShaftUnpackDownscale / ShaftPackFactors.rgb,
  1.0 / ShaftPackFactors.a
);

float shaftUnpack(const in vec4 v) {
  return dot(v, ShaftUnpackFactors);
}

/** Three's own depth convention: negative, in view space. */
float shaftViewZ(float d) {
  return (uNear * uFar) / ((uFar - uNear) * d - uFar);
}

/**
 * Henyey-Greenstein. Air scatters forward, so a shaft is far brighter looked
 * at along its length toward the sun than across it. Without this every shaft
 * is equally bright from every angle, which reads as fog rather than a beam.
 *
 * g is 0.38 rather than the 0.7-0.8 that fits real atmospheric dust. At 0.72
 * the forward lobe is eighty times the sideways one and the effect becomes
 * all-or-nothing: invisible across the room, a white disc down the doorway.
 */
float shaftPhase(float cosT, float g) {
  float g2 = g * g;
  float d = 1.0 + g2 - 2.0 * g * cosT;
  return (1.0 - g2) / (4.0 * 3.14159265 * max(d * sqrt(d), 1e-4));
}

/** Interleaved gradient noise. Cheap, and does not tile against the grid. */
float shaftDither(vec2 c) {
  return fract(52.9829189 * fract(dot(c, vec2(0.06711056, 0.00583715))));
}

/** Can this point in mid-air see the sun? */
float shaftSunlit(vec3 p) {
  vec4 sc = uSunMatrix * vec4(p, 1.0);
  vec3 c = sc.xyz / sc.w;
  // Outside the sun's view there is no information. Treating that as shadow
  // draws a hard-edged box around the barn on the floor.
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  return step(c.z - 0.0022, shaftUnpack(texture2D(uSunDepth, c.xy)));
}

/** 1 inside the barn, falling off over half a metre so the volume has no edge. */
float shaftInside(vec3 p) {
  vec3 d = min(p - uBoxMin, uBoxMax - p);
  return clamp(min(min(d.x, d.y), d.z) / 0.5, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (uIntensity <= 0.0) {
    outputColor = inputColor;
    return;
  }

  // Where the view ray stops: the surface the depth buffer recorded.
  float viewZ = shaftViewZ(depth);
  vec4 clip = vec4(uv * 2.0 - 1.0, 0.5, 1.0);
  vec4 unproj = uInverseProjection * clip;
  vec3 dirView = unproj.xyz / unproj.w;
  dirView /= -dirView.z;
  vec3 viewPos = dirView * -viewZ;
  vec3 worldPos = (uCameraMatrixWorld * vec4(viewPos, 1.0)).xyz;

  vec3 ray = worldPos - uCameraPos;
  float sceneDist = length(ray);
  vec3 dir = ray / max(sceneDist, 1e-4);

  float marchLen = min(sceneDist, uMaxDistance);
  float stepLen = marchLen / float(${STEPS});

  float t = stepLen * shaftDither(gl_FragCoord.xy);
  float acc = 0.0;
  for (int i = 0; i < ${STEPS}; i++) {
    vec3 p = uCameraPos + dir * t;
    acc += shaftSunlit(p) * shaftInside(p);
    t += stepLen;
  }

  /*
   * Saturating, not linear. The lit path length along a ray runs from about a
   * metre across a single shaft to twenty down the middle of the doorway, and
   * forward scattering multiplies that spread again — so a straight sum blows
   * the frame to white the moment the camera turns anywhere near the sun,
   * which at this hour is straight out the door. Exponential saturation is
   * both the fix and the physically honest form: in-scattering approaches
   * opacity, it does not keep climbing.
   */
  float lit = acc * stepLen * shaftPhase(dot(dir, uSunDir), 0.38);
  float scatter = 1.0 - exp(-lit * uIntensity);

  /*
   * Mixed toward the light, not added to it. Adding is what a beam does to a
   * lens; a volume of lit air does something else — it *replaces* what is
   * behind it in proportion to its own opacity. Added, the shafts kept
   * climbing on top of the range framed in the doorway and blew the summits
   * out. Mixed, the same haze veils them, which is what haze does, and the
   * brightest thing in the frame stays the sky rather than the air in front
   * of it.
   */
  outputColor = vec4(mix(inputColor.rgb, uSunColor, scatter), inputColor.a);
}
`

class ShaftsEffect extends Effect {
  constructor() {
    super('Shafts', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uSunDepth', new THREE.Uniform(null)],
        ['uSunMatrix', new THREE.Uniform(new THREE.Matrix4())],
        ['uInverseProjection', new THREE.Uniform(new THREE.Matrix4())],
        ['uCameraMatrixWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uCameraPos', new THREE.Uniform(new THREE.Vector3())],
        ['uSunDir', new THREE.Uniform(new THREE.Vector3(0, 1, 0))],
        ['uSunColor', new THREE.Uniform(new THREE.Color('#ffffff'))],
        ['uIntensity', new THREE.Uniform(0)],
        ['uNear', new THREE.Uniform(0.1)],
        ['uFar', new THREE.Uniform(400)],
        ['uMaxDistance', new THREE.Uniform(18)],
        ['uBoxMin', new THREE.Uniform(new THREE.Vector3())],
        ['uBoxMax', new THREE.Uniform(new THREE.Vector3())],
      ]),
    })
  }
}

/**
 * The volume the dust lives in: the barn, plus a little past the doorway so a
 * shaft does not stop dead at the threshold.
 */
const BOX_MIN = new THREE.Vector3(-BARN.halfWidth, 0, BARN.frontZ - 1.2)
const BOX_MAX = new THREE.Vector3(BARN.halfWidth, BARN.ridgeY, BARN.backZ)

/** Clip space to texture space, exactly as three builds its own shadow matrix. */
const BIAS = new THREE.Matrix4().set(
  0.5, 0.0, 0.0, 0.5,
  0.0, 0.5, 0.0, 0.5,
  0.0, 0.0, 0.5, 0.5,
  0.0, 0.0, 0.0, 1.0,
)

export function Shafts({ light }: { light: SceneLight }) {
  const effect = useMemo(() => new ShaftsEffect(), [])
  const { camera, gl, scene } = useThree()
  const dir = useRef(new THREE.Vector3())

  const sun = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(SUN_MAP, SUN_MAP, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
    })
    const cam = new THREE.OrthographicCamera(
      -SUN_EXTENT,
      SUN_EXTENT,
      SUN_EXTENT,
      -SUN_EXTENT,
      0.5,
      190,
    )
    const material = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      // Some of the siding is double-sided. Front faces only would drop
      // whichever boards happen to face away from the sun, and the gaps
      // between them would stop being gaps.
      side: THREE.DoubleSide,
    })
    return { target, cam, material }
  }, [])

  useFrame(() => {
    const u = effect.uniforms

    /*
     * Nothing to march at night, and marching it anyway costs a whole extra
     * pass over the barn plus forty texture fetches a pixel to add zero.
     */
    if (!light.sunUp || light.sunIntensity <= 0.01) {
      u.get('uIntensity')!.value = 0
      return
    }

    // Depth from the sun, into a target this file owns end to end.
    sun.cam.position.copy(light.sunPosition)
    sun.cam.lookAt(0, 0, 0)
    sun.cam.updateMatrixWorld()

    const veil = veiled(scene)
    for (const o of veil) o.visible = false
    const prevOverride = scene.overrideMaterial
    const prevTarget = gl.getRenderTarget()
    // Every gl.render rebuilds the shadow maps. This pass does not need them.
    const prevAuto = gl.shadowMap.autoUpdate
    gl.shadowMap.autoUpdate = false
    scene.overrideMaterial = sun.material
    gl.setRenderTarget(sun.target)
    gl.clear()
    gl.render(scene, sun.cam)
    gl.setRenderTarget(prevTarget)
    scene.overrideMaterial = prevOverride
    gl.shadowMap.autoUpdate = prevAuto
    for (const o of veil) o.visible = true

    const m = u.get('uSunMatrix')!.value as THREE.Matrix4
    m.copy(BIAS).multiply(sun.cam.projectionMatrix).multiply(sun.cam.matrixWorldInverse)

    u.get('uSunDepth')!.value = sun.target.texture

    const cam = camera as THREE.PerspectiveCamera
    u.get('uInverseProjection')!.value = cam.projectionMatrixInverse
    u.get('uCameraMatrixWorld')!.value = cam.matrixWorld
    u.get('uCameraPos')!.value = cam.position
    u.get('uNear')!.value = cam.near
    u.get('uFar')!.value = cam.far

    u.get('uSunDir')!.value = dir.current.copy(light.sunPosition).normalize()
    u.get('uSunColor')!.value = light.sunColor
    u.get('uBoxMin')!.value = BOX_MIN
    u.get('uBoxMax')!.value = BOX_MAX

    /*
     * Scattering rides the sun and drops away under cloud, because it should:
     * overcast removes the direction from the light, and a shaft is nothing
     * but direction. It is strongest at low sun, partly because the air path
     * is longer and mostly because that is when it is worth looking at.
     */
    const low = Math.pow(1 - Math.min(light.sunIntensity / 3.9, 1), 1.4)
    u.get('uIntensity')!.value = 0.15 * (0.5 + low * 0.7) * (1 - 0.85 * light.cloudCover)
  })

  return <primitive object={effect} />
}
