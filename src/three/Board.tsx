import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

/**
 * A painted board with a photograph on its face.
 *
 * There are four hand-painted boards in this building and they used to be one
 * drawn canvas repeated, so this exists mostly to stop the same four lines of
 * texture setup being written out four times. But it also fixes something the
 * single sign had wrong and nobody would have noticed until they walked round
 * it: a `boxGeometry` with one material puts the same map on all six faces, so
 * the 35mm edge of the board was a vertical slice of the lettering, stretched
 * along a strip a thirtieth of its own width. Real boards have sawn edges.
 *
 * Faces are supplied separately because a two-sided exterior sign does not
 * weather evenly — the side that takes the weather loses its paint first — and
 * a board leaning against a wall only needs one face at all.
 *
 * Box face order in three is +X, −X, +Y, −Y, +Z, −Z, which is why the array
 * below looks the way it does. The −Z face's UVs are already mirrored relative
 * to +Z, so lettering on the back reads correctly when you walk round rather
 * than coming out backwards.
 */
export function Board({
  front,
  back,
  edge,
  size,
  ...props
}: {
  /** URL of the face map, relative to BASE_URL. */
  front: string
  /** URL of the reverse. Omitted, the reverse is bare timber. */
  back?: string
  /** The sawn edge, and the reverse when there is no `back`. */
  edge: THREE.Material
  /** Width, height, thickness, in metres. */
  size: [number, number, number]
} & React.ComponentProps<'mesh'>) {
  const urls = useMemo(
    () => [front, ...(back ? [back] : [])].map((u) => `${import.meta.env.BASE_URL}${u}`),
    [front, back],
  )
  const maps = useTexture(urls) as THREE.Texture[]

  const materials = useMemo(() => {
    const faces = maps.map((m) => {
      m.colorSpace = THREE.SRGBColorSpace
      m.anisotropy = 8
      m.needsUpdate = true
      return new THREE.MeshStandardMaterial({ map: m, roughness: 0.86 })
    })
    const rear = faces[1] ?? edge
    return [edge, edge, edge, edge, faces[0], rear]
  }, [maps, edge])

  return (
    <mesh material={materials} {...props}>
      <boxGeometry args={size} />
    </mesh>
  )
}
