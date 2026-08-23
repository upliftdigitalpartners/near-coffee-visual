import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useBrass, useCastIron, useChrome } from './surfaces'

/**
 * A lever machine.
 *
 * This was a box with a smaller box on top of it, and at the counter stop —
 * where a visitor stands closest to it — that was the single most obviously
 * fake object in the building. The intention was always a downloaded CC0 glTF
 * model; every source for one is refused at this network's egress proxy, so it
 * is modelled here instead.
 *
 * The technique that matters is LatheGeometry. Almost every part of an espresso
 * machine is turned on a lathe — the boiler, its domed ends, the group head,
 * the portafilter, the knobs — and a lathed profile is the one thing a box can
 * never fake, because what reads as "machined metal" is a continuous curved
 * highlight running round a surface of revolution. Ten points in a profile
 * array buy more than a hundred boxes.
 *
 * Orientation: the counter runs along Z at x 3.6 to 4.6, and customers stand at
 * x below 3.6, so the machine faces -X. The boiler lies along Z, the group head
 * and the lever hang off the -X face, and the steam wand comes off the corner
 * nearest the customer — which is where it is on a real one, because the
 * barista pulls it toward themselves to steam.
 */

/** Profile of the boiler: a cylinder with turned, domed ends. */
function boilerProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  const R = 0.155
  const half = 0.34
  // Rear dome.
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.sin(a) * R, -half - Math.cos(a) * 0.09))
  }
  // A pair of raised bands where the shell is bolted, which is what stops a
  // lathed cylinder reading as a piece of pipe.
  pts.push(new THREE.Vector2(R, -half + 0.02))
  pts.push(new THREE.Vector2(R * 1.06, -half + 0.03))
  pts.push(new THREE.Vector2(R * 1.06, -half + 0.06))
  pts.push(new THREE.Vector2(R, -half + 0.07))
  pts.push(new THREE.Vector2(R, half - 0.07))
  pts.push(new THREE.Vector2(R * 1.06, half - 0.06))
  pts.push(new THREE.Vector2(R * 1.06, half - 0.03))
  pts.push(new THREE.Vector2(R, half - 0.02))
  // Front dome.
  for (let i = 6; i >= 0; i--) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push(new THREE.Vector2(Math.sin(a) * R, half + Math.cos(a) * 0.09))
  }
  return pts
}

/**
 * Group head: the turned brass body the portafilter locks into.
 *
 * Short and slim, and that is a correction. The first version was 15cm tall and
 * 6cm across, which is roughly the size of the boiler's own radius — so the two
 * groups spanned the same height as the boiler and read as a pair of columns
 * holding it up, rather than as fittings hanging off the front of it. A group
 * head is a small thing bolted to a big thing.
 */
function groupProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.044, 0),
    new THREE.Vector2(0.044, 0.022),
    new THREE.Vector2(0.052, 0.028),
    new THREE.Vector2(0.052, 0.042),
    new THREE.Vector2(0.04, 0.052),
    new THREE.Vector2(0.04, 0.075),
    new THREE.Vector2(0.03, 0.086),
    new THREE.Vector2(0.03, 0.1),
  ]
}

function lathe(points: THREE.Vector2[], segments = 28): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points, segments)
  g.computeVertexNormals()
  return g
}

export function EspressoMachine() {
  const chrome = useChrome()
  const brass = useBrass()
  const iron = useCastIron()
  const lever = useRef<THREE.Group>(null)

  const geo = useMemo(
    () => ({
      boiler: lathe(boilerProfile(), 36),
      group: lathe(groupProfile(), 24),
      portafilter: lathe(
        [
          new THREE.Vector2(0.044, 0),
          new THREE.Vector2(0.046, 0.012),
          new THREE.Vector2(0.05, 0.03),
          new THREE.Vector2(0.05, 0.046),
          new THREE.Vector2(0.038, 0.05),
        ],
        22,
      ),
      knob: lathe(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.018, 0.004),
          new THREE.Vector2(0.02, 0.02),
          new THREE.Vector2(0.013, 0.034),
          new THREE.Vector2(0, 0.038),
        ],
        16,
      ),
    }),
    [],
  )

  /*
   * The lever rests, but not perfectly still. A spring-lever machine sits under
   * load and the arm creeps; a dead-still lever is the giveaway that nothing in
   * the object is alive. Two degrees, very slowly.
   */
  useFrame((state) => {
    if (!lever.current) return
    const t = state.clock.elapsedTime
    lever.current.rotation.z = -0.42 + Math.sin(t * 0.31) * 0.02
  })

  return (
    <group>
      {/* Drip tray and its grate, sitting on the counter. */}
      <mesh position={[0, 0.022, 0]} material={iron} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.045, 0.72]} />
      </mesh>
      {Array.from({ length: 11 }, (_, i) => (
        <mesh
          key={i}
          position={[0, 0.048, -0.3 + i * 0.06]}
          material={chrome}
          castShadow
        >
          <boxGeometry args={[0.4, 0.008, 0.018]} />
        </mesh>
      ))}

      {/* The boiler, lying along the counter. */}
      <group position={[0.02, 0.235, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geo.boiler} material={chrome} castShadow receiveShadow />
      </group>

      {/* Cup rail, where the cups warm. */}
      {[-0.19, 0.19].map((z) => (
        <mesh key={z} position={[0.02, 0.4, z]} material={brass} castShadow>
          <boxGeometry args={[0.3, 0.012, 0.012]} />
        </mesh>
      ))}

      {/* Two group heads on the customer side, each with a portafilter in. */}
      {[-0.16, 0.16].map((z) => (
        <group key={z} position={[-0.148, 0.132, z]}>
          <mesh geometry={geo.group} material={brass} castShadow />
          <mesh
            geometry={geo.portafilter}
            material={chrome}
            position={[0, -0.052, 0]}
            castShadow
          />
          {/* Portafilter handle, angled down and out toward the barista. */}
          {/* Handle out toward the barista, dropping slightly, as they hang. */}
          <mesh
            position={[-0.098, -0.052, 0]}
            rotation={[0, 0, Math.PI / 2 + 0.22]}
            castShadow
          >
            <cylinderGeometry args={[0.013, 0.016, 0.1, 12]} />
            <meshStandardMaterial color="#241a12" roughness={0.62} />
          </mesh>
        </group>
      ))}

      {/* The lever, and the wooden ball on the end of it. */}
      <group ref={lever} position={[-0.135, 0.255, -0.16]}>
        <mesh position={[-0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={chrome} castShadow>
          <cylinderGeometry args={[0.011, 0.011, 0.27, 12]} />
        </mesh>
        <mesh position={[-0.27, 0, 0]} castShadow>
          <sphereGeometry args={[0.028, 18, 14]} />
          <meshStandardMaterial color="#2a1d12" roughness={0.5} />
        </mesh>
      </group>

      {/* Steam wand, on the corner nearest the customer. */}
      <group position={[-0.13, 0.2, 0.34]}>
        <mesh rotation={[0, 0, -0.5]} material={chrome} castShadow>
          <cylinderGeometry args={[0.009, 0.009, 0.16, 10]} />
        </mesh>
        <mesh position={[-0.055, -0.11, 0]} rotation={[0, 0, -0.16]} material={chrome} castShadow>
          <cylinderGeometry args={[0.007, 0.005, 0.13, 10]} />
        </mesh>
        <mesh geometry={geo.knob} material={brass} position={[0.02, 0.09, 0]} castShadow />
      </group>

      {/* Pressure gauge, on the front dome where the barista can read it. */}
      <group position={[-0.05, 0.33, -0.36]} rotation={[Math.PI / 2.6, 0, 0]}>
        <mesh material={brass} castShadow>
          <cylinderGeometry args={[0.042, 0.042, 0.022, 24]} />
        </mesh>
        <mesh position={[0, 0.013, 0]}>
          <cylinderGeometry args={[0.034, 0.034, 0.002, 24]} />
          <meshStandardMaterial color="#e8e2d4" roughness={0.3} />
        </mesh>
      </group>

      {/* Water tap on the far end, and its handle. */}
      <group position={[-0.1, 0.2, -0.34]}>
        <mesh rotation={[0, 0, -0.35]} material={chrome} castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.14, 10]} />
        </mesh>
        <mesh geometry={geo.knob} material={brass} position={[0.025, 0.08, 0]} castShadow />
      </group>
    </group>
  )
}
