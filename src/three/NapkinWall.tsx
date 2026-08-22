import { useMemo } from 'react'
import * as THREE from 'three'
import { BARN } from './Barn'
import { ageOf, napkinTexture, type Napkin } from '../wall/napkins'

/**
 * Notes pinned to the boards beside the door.
 *
 * Placed on the gable end to the left of the opening, which is where the
 * seated camera is already looking, and where the light coming through the
 * door falls across them. They are physical objects in the room: lit, casting
 * their own small shadows, and scraping past the doorframe as you move.
 *
 * A note fades over its seven days rather than vanishing on a timer, so the
 * wall always has a gradient of old and new on it.
 */

/** The strip of wall between the south corner and the door opening. */
const AREA = {
  x0: -5.4,
  x1: BARN.door.x0 - 0.5,
  y0: 1.15,
  y1: 3.1,
  /** Just inside the gable end, clear of the siding. */
  z: BARN.frontZ + 0.09,
}

const NAPKIN_W = 0.3
const NAPKIN_H = 0.19

/**
 * Deterministic placement from the note's own id, so a napkin does not jump
 * around the wall between reloads or when someone else pins one.
 */
function placement(id: string, index: number) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const a = ((h >>> 0) % 1000) / 1000
  const b = ((h >>> 10) % 1000) / 1000
  const c = ((h >>> 20) % 1000) / 1000

  // Loose grid, then jitter — otherwise they either overlap or look aligned.
  const cols = 4
  const col = index % cols
  const row = Math.floor(index / cols) % 5
  const cellW = (AREA.x1 - AREA.x0) / cols
  const cellH = (AREA.y1 - AREA.y0) / 5

  return {
    x: AREA.x0 + cellW * (col + 0.5) + (a - 0.5) * cellW * 0.42,
    y: AREA.y0 + cellH * (row + 0.5) + (b - 0.5) * cellH * 0.36,
    tilt: (c - 0.5) * 0.34,
    seed: h >>> 0,
  }
}

function Pinned({ napkin, index }: { napkin: Napkin; index: number }) {
  const { x, y, tilt, seed } = useMemo(
    () => placement(napkin.id, index),
    [napkin.id, index],
  )

  const map = useMemo(() => {
    const t = new THREE.CanvasTexture(napkinTexture(napkin.text, seed))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [napkin.text, seed])

  /*
   * Fade with age, but never all the way to nothing before the cutoff — a
   * note that is technically present and invisible for its last day just
   * looks like a rendering bug.
   */
  const age = ageOf(napkin)
  const opacity = 1 - age * 0.72

  return (
    <group position={[x, y, AREA.z]} rotation={[0, 0, tilt]}>
      <mesh castShadow receiveShadow>
        <planeGeometry args={[NAPKIN_W, NAPKIN_H]} />
        <meshStandardMaterial
          map={map}
          roughness={0.95}
          metalness={0}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The pin. Small, but it is the difference between pinned and floating. */}
      <mesh position={[0, NAPKIN_H / 2 - 0.018, 0.006]}>
        <sphereGeometry args={[0.0075, 8, 6]} />
        <meshStandardMaterial color="#6b3a2a" roughness={0.45} metalness={0.35} />
      </mesh>
    </group>
  )
}

export function NapkinWall({ napkins }: { napkins: Napkin[] }) {
  // Newest first, and cap what is drawn: the wall is a wall, not a feed.
  const shown = useMemo(
    () => [...napkins].sort((a, b) => b.at - a.at).slice(0, 20),
    [napkins],
  )

  return (
    <group>
      {shown.map((n, i) => (
        <Pinned key={n.id} napkin={n} index={i} />
      ))}
    </group>
  )
}
