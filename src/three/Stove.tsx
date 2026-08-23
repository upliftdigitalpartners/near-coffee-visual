import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useBrass, useCastIron } from './surfaces'
import type { SceneLight } from './lighting'

/**
 * A cast-iron parlour stove.
 *
 * It was a cylinder with a thinner cylinder on top of it for a flue, and from
 * the chair beside it — which is now a seat a visitor can take — it filled the
 * frame as a featureless black tube. Like the espresso machine, this wants a
 * downloaded CC0 model and cannot have one; every source is refused at this
 * network's egress proxy.
 *
 * The silhouette is the whole job. A parlour stove is a turned casting: it
 * swells at the firebox, steps in at a shoulder, and finishes in a flanged top
 * plate, and it stands on four short legs so you can see under it. The legs
 * matter more than they should — a stove sitting flat on the floor reads as a
 * bin, and 12cm of shadow underneath is most of what says "heavy iron object
 * resting on boards".
 *
 * The door faces -Z, toward the room, because that is where everyone looks at
 * it from, including the seat.
 */

function bodyProfile(): THREE.Vector2[] {
  return [
    // Base flange, sitting on the legs.
    new THREE.Vector2(0.0, 0.12),
    new THREE.Vector2(0.34, 0.12),
    new THREE.Vector2(0.36, 0.15),
    new THREE.Vector2(0.35, 0.19),
    // Firebox, swelling out.
    new THREE.Vector2(0.38, 0.28),
    new THREE.Vector2(0.395, 0.46),
    new THREE.Vector2(0.385, 0.62),
    // Shoulder, stepping in.
    new THREE.Vector2(0.34, 0.74),
    new THREE.Vector2(0.30, 0.8),
    new THREE.Vector2(0.295, 0.86),
    // Top plate, flanged and proud.
    new THREE.Vector2(0.33, 0.9),
    new THREE.Vector2(0.335, 0.945),
    new THREE.Vector2(0.30, 0.96),
    new THREE.Vector2(0.0, 0.965),
  ]
}

/** The collar the flue pipe seats into. */
function collarProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.075, 0),
    new THREE.Vector2(0.105, 0.01),
    new THREE.Vector2(0.105, 0.05),
    new THREE.Vector2(0.088, 0.075),
    new THREE.Vector2(0.088, 0.1),
  ]
}

export function Stove({ light }: { light: SceneLight }) {
  const iron = useCastIron()
  const brass = useBrass()
  const glow = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.PointLight>(null)

  const geo = useMemo(
    () => ({
      body: new THREE.LatheGeometry(bodyProfile(), 40),
      collar: new THREE.LatheGeometry(collarProfile(), 20),
      knob: new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.016, 0.006),
          new THREE.Vector2(0.019, 0.022),
          new THREE.Vector2(0.011, 0.04),
          new THREE.Vector2(0, 0.044),
        ],
        16,
      ),
    }),
    [],
  )

  /*
   * Firelight, on two frequencies that do not divide into one another. A single
   * sine reads as a pulse — something electrical blinking — and the whole point
   * of a fire is that it never repeats.
   */
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const f = 1 + Math.sin(t * 6.1) * 0.13 + Math.sin(t * 2.3) * 0.09
    if (lamp.current) lamp.current.intensity = (light.lampIntensity * 3.4 + 0.5) * f
    if (glow.current) {
      ;(glow.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.15 * f
    }
  })

  return (
    <group>
      {/* Four short legs, so there is shadow under it. */}
      {[0.7, 2.27, 3.84, 5.41].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26]}
          material={iron}
          castShadow
        >
          <cylinderGeometry args={[0.028, 0.038, 0.12, 8]} />
        </mesh>
      ))}

      <mesh geometry={geo.body} material={iron} castShadow receiveShadow />

      {/*
       * The door, on the room side, standing proud of the casting.
       *
       * At z = -0.365 it sat *inside* the body, whose radius swells to 0.395
       * at this height, so the mica window intersected the curved shell and
       * came out as a hard-edged orange wedge poking through the side. A real
       * stove door is a separate casting bolted onto the front with its frame
       * standing off the shell, so pushing it out to -0.40 both fixes the
       * clipping and is what the object actually looks like.
       */}
      <group position={[0, 0.44, -0.4]}>
        <mesh material={iron} castShadow>
          <boxGeometry args={[0.34, 0.3, 0.035]} />
        </mesh>
        {/* Mica window. Warm, and the reason anyone sits here. */}
        <mesh ref={glow} position={[0, 0.015, -0.021]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.2, 0.15]} />
          <meshStandardMaterial
            color="#3a1206"
            emissive={new THREE.Color('#ff7a24')}
            emissiveIntensity={1.15}
          />
        </mesh>
        <mesh geometry={geo.knob} material={brass} position={[0.13, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow />
        {[-0.1, 0.1].map((y) => (
          <mesh key={y} position={[-0.16, y, -0.01]} material={iron} castShadow>
            <cylinderGeometry args={[0.014, 0.014, 0.05, 10]} />
          </mesh>
        ))}
      </group>

      {/* Ash lip, catching what falls out when the door is opened. */}
      <mesh position={[0, 0.145, -0.4]} material={iron} castShadow>
        <boxGeometry args={[0.4, 0.03, 0.12]} />
      </mesh>

      {/* Collar and flue, up through the roof. */}
      <mesh geometry={geo.collar} material={iron} position={[0, 0.96, 0]} castShadow />
      <mesh position={[0, 2.15, 0]} material={iron} castShadow>
        <cylinderGeometry args={[0.085, 0.085, 2.3, 16]} />
      </mesh>
      {/* The band where two lengths of pipe join. */}
      <mesh position={[0, 1.5, 0]} material={iron} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.05, 16]} />
      </mesh>

      <pointLight
        ref={lamp}
        position={[0, 0.45, -0.5]}
        color="#ff7b2e"
        intensity={1}
        distance={5.5}
        decay={2}
        castShadow={false}
      />
    </group>
  )
}
