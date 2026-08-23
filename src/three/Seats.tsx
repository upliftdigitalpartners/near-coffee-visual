import { useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { SEATS } from '../scene/seats'

/**
 * The four markers that say you may sit here.
 *
 * A chair you can look at and not use is worse than no chair, so the seats
 * have to advertise themselves. The difficulty is that anything obvious enough
 * to notice is also obvious enough to ruin a photorealistic room — a floating
 * icon over every stool and the barn becomes a level.
 *
 * So they are rings of light on the floor: no geometry above ankle height,
 * nothing that reads as an interface, and they breathe slowly so they catch
 * the eye by moving rather than by being bright. Hovering brings one up to
 * full and names it. It is close to what a low sun through the siding already
 * does to that floor, which is why it sits in the scene instead of on top of
 * it.
 */

const RING_INNER = 0.34
const RING_OUTER = 0.46

function Marker({
  index,
  onSit,
  hidden,
}: {
  index: number
  onSit: (i: number) => void
  hidden: boolean
}) {
  const seat = SEATS[index]
  const mesh = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (!mesh.current) return
    const m = mesh.current.material as THREE.MeshBasicMaterial
    const t = state.clock.elapsedTime
    /*
     * Phase-shifted per marker. In step they pulse like a row of indicator
     * lights, which is exactly the reading to avoid; out of step they read as
     * four separate things that happen to glow.
     */
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + index * 1.7)
    const want = hidden ? 0 : hovered ? 0.42 : 0.1 + pulse * 0.07
    m.opacity = THREE.MathUtils.damp(m.opacity, want, 8, 0.016)
  })

  /*
   * The ring goes on the floor under the seat, not at head height — seat.at is
   * where the sitter's eye is, so the marker drops to the boards beneath it.
   * The porch bench sits on a raised deck, hence the floor height coming from
   * the seat's own tray rather than a constant.
   */
  const floorY = seat.label === 'the porch bench' ? 0.1 : 0.035

  return (
    <group position={[seat.at.x, floorY, seat.at.z]}>
      <mesh
        ref={mesh}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'default'
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSit(index)
        }}
      >
        <ringGeometry args={[RING_INNER, RING_OUTER, 48]} />
        <meshBasicMaterial
          color="#ffcf9a"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {hovered && !hidden && (
        <Html center position={[0, 0.5, 0]} distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <span className="tag">{seat.label}</span>
        </Html>
      )}
    </group>
  )
}

export function Seats({
  onSit,
  seated,
}: {
  onSit: (i: number) => void
  /** Index of the seat you are in, or null. Markers hide while you sit. */
  seated: number | null
}) {
  return (
    <group>
      {SEATS.map((_, i) => (
        <Marker key={i} index={i} onSit={onSit} hidden={seated !== null} />
      ))}
    </group>
  )
}
