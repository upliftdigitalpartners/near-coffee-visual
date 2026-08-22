import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { silhouetteCanvas, type Peer } from '../presence/presence'
import type { SceneLight } from './lighting'

/**
 * The other people in the barn.
 *
 * Billboarded silhouettes rather than models. A billboard always faces you, so
 * a flat dark shape reads as a person from every angle without ever resolving
 * into a character you could describe — which is exactly the register this
 * wants. You register that someone is at the far table. You could not pick
 * them out of a line-up. That is the whole idea.
 *
 * They fade in when someone arrives and fade out when they go, because a
 * person popping into existence in the corner of a quiet room is alarming.
 */

/** Chairs, in the order they fill up. Nobody sits at your table. */
const SEATS: Array<[number, number]> = [
  [-3.2, 1.35],
  [-4.3, -0.35],
  [-2.1, -0.55],
  [3.05, 2.2],
  [-4.9, 2.6],
  [2.6, -0.4],
  [-1.4, 2.9],
  [3.4, 0.1],
]

const WIDTH = 0.78
const HEIGHT = 0.98
/** Seated eye-ish height; the table crops them at the waist. */
const BASE_Y = 0.78

function hashOf(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function Figure({ peer, seatIndex, opacity }: { peer: Peer; seatIndex: number; opacity: number }) {
  const group = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const hash = useMemo(() => hashOf(peer.id), [peer.id])

  const map = useMemo(() => {
    const t = new THREE.CanvasTexture(silhouetteCanvas(hash))
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [hash])

  const [sx, sz] = SEATS[seatIndex % SEATS.length]
  // A little scatter so two people never sit identically.
  const jitterX = (((hash >>> 3) % 100) / 100 - 0.5) * 0.22
  const jitterZ = (((hash >>> 11) % 100) / 100 - 0.5) * 0.22
  const scale = 0.92 + ((hash >>> 17) % 100) / 100 * 0.16
  const phase = ((hash >>> 23) % 100) / 100 * Math.PI * 2

  useFrame((state, delta) => {
    const g = group.current
    const m = mat.current
    if (!g || !m) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    // Always face the camera, but only around the vertical axis — tilting a
    // seated person to follow the camera's pitch looks like a floating decal.
    g.rotation.y = Math.atan2(
      state.camera.position.x - g.position.x,
      state.camera.position.z - g.position.z,
    )

    // Breathing, and the occasional shift in the seat.
    const breathe = Math.sin(t * 0.7 + phase) * 0.006
    const shift = Math.sin(t * 0.13 + phase * 1.7) * 0.012
    g.position.y = BASE_Y + breathe
    g.position.x = sx + jitterX + shift

    m.opacity = THREE.MathUtils.damp(m.opacity, opacity, 1.6, dt)
  })

  return (
    <group ref={group} position={[sx + jitterX, BASE_Y, sz + jitterZ]} scale={scale}>
      <mesh>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        {/*
          Unlit on purpose. A silhouette that catches the room's light stops
          being a silhouette and starts being a grey object.
        */}
        <meshBasicMaterial
          ref={mat}
          map={map}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function Presence({ peers, light }: { peers: Peer[]; light: SceneLight }) {
  // Stable seating: sort by id so the same person keeps the same chair as
  // others come and go.
  const seated = useMemo(
    () => [...peers].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, SEATS.length),
    [peers],
  )

  /*
   * A flat black shape sits heavily in a bright room and almost vanishes in a
   * dark one, so the target opacity follows the light rather than being fixed.
   * This is opacity, not scale — scaling them would just squash people.
   */
  const opacity = 0.5 + light.cloudCover * 0.08 + (light.sunUp ? 0.12 : -0.06)

  return (
    <group>
      {seated.map((p, i) => (
        <Figure key={p.id} peer={p} seatIndex={i} opacity={opacity} />
      ))}
    </group>
  )
}
