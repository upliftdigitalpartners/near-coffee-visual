import { useMemo } from 'react'
import * as THREE from 'three'
import { BARN } from './Barn'
import { chalkboardTexture, type Bake } from '../wall/bake'

/**
 * The board by the door.
 *
 * Hung on the gable end to the right of the opening, mirroring the napkin wall
 * on the left — so from the table you have visitors' notes on one side and the
 * day's bake on the other, with the mountains between them.
 *
 * Unlike the napkins this is lit normally: a chalkboard is a solid object in
 * the room and should darken at night like everything else. It hangs slightly
 * proud of the boards, on a batten, and leans back a degree the way a heavy
 * frame on a nail does.
 */

const WIDTH = 1.5
const HEIGHT = 0.94
const POS: [number, number, number] = [3.5, 2.15, BARN.frontZ + 0.11]

export function Chalkboard({ bake }: { bake: Bake | null }) {
  const map = useMemo(() => {
    const t = new THREE.CanvasTexture(chalkboardTexture(bake?.text ?? null))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [bake?.text])

  const frame = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#43331f', roughness: 0.85 }),
    [],
  )

  return (
    <group position={POS} rotation={[0.03, 0, 0]}>
      {/*
       * The frame is a box 0.05 deep. Centred at -0.02 its front face lands at
       * +0.005 — in front of a slate at zero, which hid the board completely
       * and left a tan rectangle on the wall. The slate now sits proud of it.
       */}
      <mesh position={[0, 0, -0.045]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH + 0.11, HEIGHT + 0.11, 0.05]} />
        <primitive object={frame} attach="material" />
      </mesh>
      <mesh position={[0, 0, -0.012]} receiveShadow>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial map={map} roughness={0.92} metalness={0} />
      </mesh>
      {/* The nail it hangs from. */}
      <mesh position={[0, HEIGHT / 2 + 0.085, -0.005]}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshStandardMaterial color="#3a3128" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  )
}
