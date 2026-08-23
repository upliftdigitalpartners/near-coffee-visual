import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useBrass, useCastIron, useChrome } from './surfaces'

/**
 * The shop grinder.
 *
 * It was a tapered cylinder with a translucent cone balanced on top, which is
 * the shape of a grinder only in the sense that a traffic cone is the shape of
 * a person. It stands on the counter beside the espresso machine, at the stop
 * where a visitor gets closest to anything, and next to a machine that is now
 * properly modelled it was the thing the eye went to.
 *
 * What actually makes a doser grinder read:
 *
 * **The doser.** The drum hanging off the front, with its fan lever and the
 * fork under it, is the silhouette. Nothing else about the object says
 * "grinder" rather than "urn" — a plain tower with a hopper could be a water
 * boiler. It is asymmetric, it sticks out toward the customer, and it throws
 * the one shadow on the counter that is not a vertical.
 *
 * **The hopper is not a cone.** It is a truncated cone with a rolled rim at
 * the top, a collar where it clamps into the body, and a lid with a knob. The
 * old one came to a point at the top, so it read as solid — a funnel narrows
 * downward, and beans go in the wide end.
 *
 * **Beans, visible.** Smoked plastic with nothing behind it is just a tinted
 * surface. A dark mass filling the lower half gives the hopper something to be
 * transparent *of*, which is the entire reason to make it transparent.
 *
 * Orientation matches the machine: the counter runs along Z and customers
 * stand at x below 3.6, so the doser, the lever and the fork all face -X.
 */

function baseProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.0],
    [0.148, 0.0],
    [0.15, 0.014],
    [0.142, 0.03],
    [0.128, 0.042],
    [0.122, 0.058],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/** The cast body: a waisted tower, stepping in above the doser. */
function bodyProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.05],
    [0.124, 0.05],
    [0.118, 0.13],
    [0.112, 0.24],
    // Step, where the doser housing ends and the burr carrier begins.
    [0.116, 0.3],
    [0.112, 0.33],
    [0.094, 0.36],
    [0.09, 0.42],
    // Knurled adjustment collar.
    [0.104, 0.44],
    [0.104, 0.482],
    [0.088, 0.5],
    [0.07, 0.512],
    [0.0, 0.512],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/**
 * The hopper: wide at the top, rolled rim, narrowing into its collar.
 *
 * Drawn as a wall with thickness rather than a single surface, so the rim
 * reads and so looking down into it does not show the outside of the far
 * wall through the near one.
 */
function hopperProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.058, 0.0],
    [0.062, 0.01],
    [0.104, 0.14],
    [0.126, 0.225],
    // Over the rolled rim and back down the inside.
    [0.131, 0.246],
    [0.126, 0.252],
    [0.12, 0.243],
    [0.098, 0.145],
    [0.056, 0.012],
    [0.052, 0.0],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/** What is in it. Follows the wall, stops part way up. */
function beanProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.0, 0.01],
    [0.056, 0.012],
    [0.094, 0.13],
    [0.108, 0.165],
    [0.0, 0.168],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/** The doser lid: a shallow turned dome with a knob. */
function doserLidProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0.104, 0.0],
    [0.106, 0.008],
    [0.09, 0.026],
    [0.05, 0.038],
    [0.022, 0.041],
    [0.02, 0.06],
    [0.03, 0.066],
    [0.024, 0.078],
    [0.0, 0.082],
  ]
  return p.map(([x, y]) => new THREE.Vector2(x, y))
}

/**
 * Shake, while it grinds.
 *
 * Small and fast: 4mm at 34 rad/s. A grinder does not sway, it buzzes, and an
 * amplitude big enough to read clearly from across the room is big enough to
 * look like the machine is coming apart.
 */
function Shake({ grinding, children }: { grinding: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    const a = grinding ? 0.004 : 0
    group.current.position.x = Math.sin(t * 34) * a
    group.current.position.y = Math.sin(t * 41 + 1.1) * a * 0.6
  })
  return <group ref={group}>{children}</group>
}

export function Grinder({ grinding = false }: { grinding?: boolean }) {
  const iron = useCastIron()
  const chrome = useChrome()
  const brass = useBrass()

  const geo = useMemo(
    () => ({
      base: new THREE.LatheGeometry(baseProfile(), 30),
      body: new THREE.LatheGeometry(bodyProfile(), 30),
      hopper: new THREE.LatheGeometry(hopperProfile(), 30),
      beans: new THREE.LatheGeometry(beanProfile(), 24),
      doserLid: new THREE.LatheGeometry(doserLidProfile(), 26),
      lid: new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.132, 0.0),
          new THREE.Vector2(0.134, 0.008),
          new THREE.Vector2(0.115, 0.026),
          new THREE.Vector2(0.06, 0.038),
          new THREE.Vector2(0.02, 0.042),
          new THREE.Vector2(0.018, 0.058),
          new THREE.Vector2(0.028, 0.064),
          new THREE.Vector2(0.0, 0.072),
        ],
        26,
      ),
    }),
    [],
  )

  return (
    <Shake grinding={grinding}>
      <mesh geometry={geo.base} material={iron} castShadow receiveShadow />
      <mesh geometry={geo.body} material={iron} castShadow receiveShadow />

      {/*
       * The doser, hanging off the front. It overlaps the body on purpose —
       * on a real machine the drum is bolted through the casting, and a drum
       * sitting tangent to the tower with daylight between them is the tell
       * that two primitives were placed next to each other.
       */}
      <group position={[-0.1, 0.19, 0]}>
        <mesh material={iron} castShadow receiveShadow>
          <cylinderGeometry args={[0.105, 0.1, 0.13, 26]} />
        </mesh>
        <mesh geometry={geo.doserLid} material={chrome} position={[0, 0.065, 0]} castShadow />
        {/* The band round its middle. */}
        <mesh position={[0, -0.055, 0]} material={chrome} castShadow>
          <cylinderGeometry args={[0.107, 0.107, 0.012, 26]} />
        </mesh>
        {/*
         * The fan lever, on the customer's left, where a right-handed barista
         * pulls it. Angled down and forward at rest.
         */}
        <group rotation={[0, 0.55, 0]}>
          <mesh position={[-0.15, -0.012, 0]} rotation={[0, 0, -0.14]} material={iron} castShadow>
            <boxGeometry args={[0.15, 0.014, 0.03]} />
          </mesh>
          <mesh position={[-0.222, -0.022, 0]} castShadow>
            <sphereGeometry args={[0.017, 14, 12]} />
            <meshStandardMaterial color="#2a1d12" roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Chute, and the fork a portafilter rests in while the doser turns. */}
      <mesh position={[-0.14, 0.1, 0]} material={iron} castShadow>
        <boxGeometry args={[0.07, 0.06, 0.075]} />
      </mesh>
      {[-0.052, 0.052].map((z) => (
        <mesh key={z} position={[-0.165, 0.072, z]} material={chrome} castShadow>
          <boxGeometry args={[0.11, 0.008, 0.014]} />
        </mesh>
      ))}

      {/* On/off, because a machine with no controls is a sculpture. */}
      <mesh
        position={[-0.108, 0.33, 0.06]}
        rotation={[0, 0, Math.PI / 2]}
        material={brass}
        castShadow
      >
        <cylinderGeometry args={[0.014, 0.014, 0.016, 14]} />
      </mesh>

      {/*
       * The hopper. Smoked plastic rather than glass: cheaper than
       * transmission, and it is what these are actually made of.
       */}
      <group position={[0, 0.49, 0]}>
        <mesh geometry={geo.beans} castShadow>
          <meshStandardMaterial color="#2b1a10" roughness={0.62} />
        </mesh>
        <mesh geometry={geo.hopper}>
          <meshStandardMaterial
            color="#4a3a2c"
            roughness={0.18}
            metalness={0.05}
            transparent
            opacity={0.42}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={geo.lid} material={chrome} position={[0, 0.246, 0]} castShadow />
      </group>
    </Shake>
  )
}
