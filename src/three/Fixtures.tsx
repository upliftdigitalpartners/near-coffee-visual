import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useWoodMaps, useWoodMaterial } from './wood'
import type { SceneLight } from './lighting'

/**
 * What is in the barn.
 *
 * The furniture is deliberately sparse. A converted homestead barn is mostly
 * air and roof, and filling it with props would fight the one thing the space
 * has going for it, which is volume.
 */

/** Furniture timber, off the same PBR set as the building. */
function useFurnitureWood(color: string, roughness = 0.85) {
  const maps = useWoodMaps()
  return useWoodMaterial(maps, { tint: color, roughness, normalScale: 0.8 })
}

/**
 * Anything you can point at. Hovering lifts it slightly and names it; the
 * cursor change is what tells people the scene is not a video.
 */
function Interactive({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!group.current) return
    const dt = Math.min(delta, 0.05)
    group.current.position.y = THREE.MathUtils.damp(
      group.current.position.y,
      hovered ? 0.028 : 0,
      6,
      dt,
    )
  })

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = onClick ? 'pointer' : 'default'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      {children}
      {hovered && (
        <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <span className="tag">{label}</span>
        </Html>
      )}
    </group>
  )
}

/** A bare bulb on a flex, of the kind someone strung up themselves. */
function Bulb({ z, on, light }: { z: number; on: boolean; light: SceneLight }) {
  const glass = useRef<THREE.Mesh>(null)
  const intensity = on ? Math.max(light.lampIntensity, 0.55) : 0

  useFrame((state) => {
    if (!glass.current) return
    // Old wiring, slight flicker.
    const t = state.clock.elapsedTime
    const flicker = 1 + Math.sin(t * 7.3 + z) * 0.02 + Math.sin(t * 2.1) * 0.015
    const m = glass.current.material as THREE.MeshStandardMaterial
    m.emissiveIntensity = intensity * 3.4 * flicker
  })

  return (
    <group position={[0, 3.5, z]}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1.1, 6]} />
        <meshStandardMaterial color="#1a1410" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.09, 12]} />
        <meshStandardMaterial color="#5c4a33" roughness={0.5} metalness={0.7} />
      </mesh>
      <mesh ref={glass}>
        <sphereGeometry args={[0.062, 20, 16]} />
        <meshStandardMaterial
          color="#fff0d2"
          emissive={new THREE.Color('#ffb257')}
          emissiveIntensity={intensity * 3.4}
          roughness={0.25}
          transparent
          opacity={0.92}
        />
      </mesh>
      <pointLight
        color={light.lampColor}
        intensity={intensity * 9}
        distance={9}
        decay={2}
        castShadow={false}
      />
    </group>
  )
}

/** Soft round falloff. Square particles read as pixels, not vapour. */
function useSteamSprite() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.42)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

const STEAM_COUNT = 34

function Steam({ position }: { position: [number, number, number] }) {
  const points = useRef<THREE.Points>(null)
  const sprite = useSteamSprite()

  /*
   * Each particle gets its own rate, phase and drift. Sharing one rate and
   * spacing the phases evenly — the obvious way to write this — puts every
   * particle at a different fixed height above the last, and the result is a
   * dotted line rising out of the cup rather than steam.
   */
  const { geometry, params } = useMemo(() => {
    const positions = new Float32Array(STEAM_COUNT * 3)
    const p = Array.from({ length: STEAM_COUNT }, () => ({
      phase: Math.random(),
      rate: 0.16 + Math.random() * 0.2,
      swirl: Math.random() * Math.PI * 2,
      spread: 0.5 + Math.random() * 1.4,
    }))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry: g, params: p }
  }, [])

  useFrame((state) => {
    if (!points.current) return
    const t = state.clock.elapsedTime
    const attr = points.current.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < STEAM_COUNT; i++) {
      const q = params[i]
      const life = (t * q.rate + q.phase) % 1
      // Widens as it rises and loses coherence, the way steam actually goes.
      const widen = Math.pow(life, 1.6) * 0.055 * q.spread
      attr.setXYZ(
        i,
        Math.sin(q.swirl + life * 4.2) * widen,
        life * 0.2,
        Math.cos(q.swirl * 1.7 + life * 3.4) * widen,
      )
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={points} geometry={geometry} position={position}>
      <pointsMaterial
        map={sprite}
        size={0.026}
        color="#fff6e8"
        transparent
        opacity={0.1}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}

export function Fixtures({
  light,
  bulbsOn,
  onToggleBulbs,
  radioLabel,
  onToggleRadio,
}: {
  light: SceneLight
  bulbsOn: boolean
  onToggleBulbs: () => void
  radioLabel: string
  onToggleRadio?: () => void
}) {
  const counterTop = useFurnitureWood('#6b543a', 0.7)
  const carcass = useFurnitureWood('#4a3a28')
  const tableTop = useFurnitureWood('#7a5f3f', 0.65)

  return (
    <group>
      {/* Counter along the north wall. */}
      <group position={[4.1, 0, 1]}>
        <mesh position={[0, 1.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.08, 4.4]} />
          <primitive object={counterTop} attach="material" />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 1.0, 4.2]} />
          <primitive object={carcass} attach="material" />
        </mesh>

        {/* Back shelf with the day's beans and a row of cups. */}
        <mesh position={[0.75, 1.85, 0]} castShadow>
          <boxGeometry args={[0.34, 0.05, 3.4]} />
          <primitive object={counterTop} attach="material" />
        </mesh>
        {[-1.2, -0.75, -0.3].map((z) => (
          <mesh key={z} position={[0.75, 2.0, z]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.22, 14]} />
            <meshStandardMaterial color="#2e2116" roughness={0.85} />
          </mesh>
        ))}
        {[0.4, 0.72, 1.04, 1.36].map((z) => (
          <mesh key={z} position={[0.75, 1.93, z]} castShadow>
            <cylinderGeometry args={[0.05, 0.042, 0.08, 14]} />
            <meshStandardMaterial color="#cfc3ad" roughness={0.55} />
          </mesh>
        ))}

        {/* The radio. Click it. */}
        <Interactive label={radioLabel} onClick={onToggleRadio}>
          <mesh position={[0, 1.2, -1.75]} castShadow>
            <boxGeometry args={[0.34, 0.22, 0.18]} />
            <meshStandardMaterial color="#54381f" roughness={0.6} />
          </mesh>
        </Interactive>
      </group>

      {/* Your table, just in front of where you are sitting. */}
      <group position={[0.9, 0, 3.1]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.62, 0.06, 28]} />
          <primitive object={tableTop} attach="material" />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.11, 0.72, 12]} />
          <primitive object={carcass} attach="material" />
        </mesh>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.04, 20]} />
          <primitive object={carcass} attach="material" />
        </mesh>

        {/*
         * The table top sits at 0.77; everything on it is measured off that,
         * not guessed, or the crockery floats. The coffee surface is set well
         * below the rim so it does not z-fight the cup it is sitting in.
         */}
        <Interactive label="yours, still hot">
          <mesh position={[0.14, 0.776, 0.06]} castShadow receiveShadow>
            <cylinderGeometry args={[0.105, 0.1, 0.012, 32]} />
            <meshStandardMaterial color="#d8ccb6" roughness={0.42} />
          </mesh>
          <mesh position={[0.14, 0.83, 0.06]} castShadow>
            <cylinderGeometry args={[0.062, 0.05, 0.095, 32]} />
            <meshStandardMaterial color="#e2d7c2" roughness={0.38} />
          </mesh>
          <mesh position={[0.14, 0.862, 0.06]}>
            <cylinderGeometry args={[0.055, 0.055, 0.004, 32]} />
            <meshStandardMaterial color="#38200f" roughness={0.18} metalness={0.05} />
          </mesh>
          {/* Handle. Without it this is a paper cup. */}
          <mesh position={[0.205, 0.832, 0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[0.035, 0.008, 10, 24, Math.PI * 1.25]} />
            <meshStandardMaterial color="#e2d7c2" roughness={0.38} />
          </mesh>
        </Interactive>
        <Steam position={[0.14, 0.878, 0.06]} />

        {/* Someone's notebook, left open. */}
        <mesh position={[-0.26, 0.779, -0.06]} rotation={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.3, 0.018, 0.22]} />
          <meshStandardMaterial color="#8c7c60" roughness={0.9} />
        </mesh>
      </group>

      {/* A second table, empty, closer to the door. */}
      <group position={[-3.2, 0, 0.4]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.06, 24]} />
          <primitive object={tableTop} attach="material" />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 0.72, 12]} />
          <primitive object={carcass} attach="material" />
        </mesh>
        {[0, Math.PI * 0.7].map((a, i) => (
          <mesh
            key={i}
            position={[Math.cos(a) * 1.0, 0.44, Math.sin(a) * 1.0]}
            castShadow
          >
            <cylinderGeometry args={[0.17, 0.15, 0.06, 16]} />
            <primitive object={tableTop} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Bulbs strung down the ridge. Click any of them. */}
      <Interactive label={bulbsOn ? 'put them out' : 'light them'} onClick={onToggleBulbs}>
        {[-1.6, 0.8, 3.2].map((z) => (
          <Bulb key={z} z={z} on={bulbsOn} light={light} />
        ))}
      </Interactive>

      {/* Wood stove in the corner — the reason the place is habitable. */}
      <group position={[-4.4, 0, 4.2]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.38, 1.0, 18]} />
          <meshStandardMaterial color="#1c1a19" roughness={0.62} metalness={0.55} />
        </mesh>
        <mesh position={[0, 2.3, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 2.6, 14]} />
          <meshStandardMaterial color="#232120" roughness={0.6} metalness={0.5} />
        </mesh>
        <pointLight
          position={[0.3, 0.45, 0]}
          color="#ff7b2e"
          intensity={light.lampIntensity * 4 + 0.6}
          distance={5}
          decay={2}
        />
      </group>
    </group>
  )
}
