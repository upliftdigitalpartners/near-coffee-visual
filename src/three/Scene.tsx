import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { Daylight } from '../scene/daylight'
import { sceneLight } from './lighting'
import { Barn, BARN } from './Barn'
import { Backdrop } from './Backdrop'
import { Fixtures } from './Fixtures'
import { CameraRig } from './CameraRig'

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

export function Scene({
  hour,
  daylight,
  onProgress,
}: {
  hour: number
  daylight: Daylight
  onProgress?: (p: number) => void
}) {
  const [bulbsOn, setBulbsOn] = useState(true)
  const light = useMemo(() => sceneLight(hour, daylight), [hour, daylight])

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

      <Barn />
      <Fixtures
        light={light}
        bulbsOn={bulbsOn}
        onToggleBulbs={() => setBulbsOn((v) => !v)}
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
