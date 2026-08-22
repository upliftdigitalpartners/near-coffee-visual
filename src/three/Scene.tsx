import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Daylight } from '../scene/daylight'
import type { Solar, Weather } from '../scene/place'
import { sceneLight } from './lighting'
import { Barn, BARN } from './Barn'
import { Backdrop } from './Backdrop'
import { Fixtures } from './Fixtures'
import { CameraRig } from './CameraRig'
import { NapkinWall } from './NapkinWall'
import type { Napkin } from '../wall/napkins'

const POST = true

/**
 * Development only.
 *
 * Automated preview panes run the page with document.visibilityState
 * permanently 'hidden', and browsers do not fire requestAnimationFrame in a
 * hidden document. The scene builds correctly, the GL context is healthy, and
 * then nothing ever draws — which looks exactly like a broken renderer and is
 * not one. This drives frames off a timer so the scene can be screenshotted
 * during development. It never runs in a production build.
 */
function HiddenDocumentDriver() {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    /*
     * The effect composer sizes its render targets from the first layout it
     * sees, and in a hidden document that lands before the real size does, so
     * it renders to a dead buffer and the screen stays black until something
     * resizes it. One nudge on mount is enough.
     */
    const id = window.setInterval(() => {
      if (document.hidden) advance(performance.now())
    }, 80)
    return () => window.clearInterval(id)
  }, [advance])
  return null
}

function Lights({ light }: { light: ReturnType<typeof sceneLight> }) {
  /*
   * The shadow camera is tightened right down onto the barn. A default-sized
   * one spread over the whole 60m backdrop gives texels the size of dinner
   * plates, and the stripes thrown by the gaps in the siding — the entire
   * reason this is 3D — turn to mush.
   */
  const shadow = useMemo(() => {
    const cam = new THREE.OrthographicCamera(-11, 11, 11, -11, 0.5, 190)
    return cam
  }, [])

  return (
    <>
      <directionalLight
        position={light.sunPosition}
        color={light.sunColor}
        intensity={light.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.022}
        shadow-camera={shadow}
      />
      <hemisphereLight
        color={light.ambientColor}
        groundColor={light.bounceColor}
        intensity={light.ambientIntensity}
      />
      {/* Bounce off the sunlit valley floor, coming back in through the door. */}
      <directionalLight
        position={[0, 1.2, -22]}
        color={light.bounceColor}
        intensity={light.bounceIntensity}
      />
    </>
  )
}


/**
 * Snow past the doorway, when it is actually snowing at the barn.
 *
 * Drawn only outside: a field of points falling through the volume in front of
 * the door, recycled at the top. Intensity comes straight from Open-Meteo's
 * snowfall reading, so most of the year this renders nothing at all — which is
 * correct, and is the point.
 */
function Snow({ amount }: { amount: number }) {
  const points = useRef<THREE.Points>(null)
  const COUNT = 900
  const AREA = 34
  const TOP = 14

  const { geometry, drift } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    const d = new Float32Array(COUNT * 2)
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * AREA
      pos[i * 3 + 1] = Math.random() * TOP
      pos[i * 3 + 2] = -4 - Math.random() * AREA
      d[i * 2] = 0.4 + Math.random() * 1.1
      d[i * 2 + 1] = Math.random() * Math.PI * 2
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return { geometry: g, drift: d }
  }, [])

  useFrame((state, delta) => {
    if (!points.current) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < COUNT; i++) {
      let y = attr.getY(i) - drift[i * 2] * dt
      let x = attr.getX(i) + Math.sin(t * 0.6 + drift[i * 2 + 1]) * dt * 0.35
      if (y < 0) {
        y = TOP
        x = (Math.random() - 0.5) * AREA
      }
      attr.setXY(i, x, y)
    }
    attr.needsUpdate = true
  })

  if (amount <= 0.001) return null

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        size={0.055}
        color="#ffffff"
        transparent
        opacity={0.28 + amount * 0.45}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

export function Scene({
  hour,
  daylight,
  solar,
  weather,
  radioLabel,
  onToggleRadio,
  napkins,
  onProgress,
}: {
  hour: number
  daylight: Daylight
  solar?: Solar | null
  weather?: Weather | null
  radioLabel: string
  onToggleRadio?: () => void
  napkins: Napkin[]
  onProgress?: (p: number) => void
}) {
  const [bulbsOn, setBulbsOn] = useState(true)
  const light = useMemo(
    () => sceneLight(hour, daylight, solar, weather),
    [hour, daylight, solar, weather],
  )

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        // Lets a hidden-document frame survive long enough to be captured.
        preserveDrawingBuffer: import.meta.env.DEV,
      }}
      camera={{ fov: 46, near: 0.1, far: 400, position: [0.9, 1.22, 4.3] }}
      onCreated={(state) => {
        ;(window as unknown as Record<string, unknown>).__r3f = state
        console.log('[r3f] created', state.gl.domElement.width, state.scene.children.length)
      }}
    >
      <color attach="background" args={[light.fogColor.getHex()]} />
      <fogExp2 attach="fog" args={[light.fogColor.getHex(), light.fogDensity]} />

      <HiddenDocumentDriver />
      <Lights light={light} />
      <CameraRig onProgress={onProgress} />

      <Suspense fallback={null}>
        <Backdrop light={light} />
      </Suspense>

      <Snow amount={light.snow} />

      <Barn />
      <NapkinWall napkins={napkins} />
      <Fixtures
        light={light}
        bulbsOn={bulbsOn}
        onToggleBulbs={() => setBulbsOn((v) => !v)}
        radioLabel={radioLabel}
        onToggleRadio={onToggleRadio}
      />

      {/* Threshold plank worn smooth by a hundred years of boots. */}
      <mesh position={[0, 0.02, BARN.frontZ]} receiveShadow>
        <boxGeometry args={[BARN.door.x1 - BARN.door.x0 + 0.4, 0.05, 0.3]} />
        <meshStandardMaterial color="#5a4832" roughness={0.8} />
      </mesh>

      {POST && (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.62} luminanceThreshold={0.72} luminanceSmoothing={0.28} mipmapBlur />
          <Vignette darkness={0.55} offset={0.26} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
