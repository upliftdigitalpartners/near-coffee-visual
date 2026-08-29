import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BARN } from './Barn'
import { chamferedBox, GRAIN, plankUVs, useWoodMaps, useWoodMaterial } from './wood'
import { useSilvered } from './coats'
import { signTexture } from '../wall/sign'

/**
 * The porch.
 *
 * Three point two metres of deck across the front of the barn, four posts, a
 * shed roof, a bench and a hanging sign — the handoff's spec, and the thing
 * that makes stepping outside worth doing. Before this, walking out the door
 * put you on bare snow with the Teton plate filling the frame unframed, at a
 * distance where the photograph visibly runs out of resolution. A porch turns
 * that into a view *out of* somewhere.
 *
 * ## The roof height is solved, not chosen
 *
 * A porch roof hangs in front of the doorway, and the doorway is the best shot
 * in the building. Get the height wrong and the roof's far edge cuts across
 * the range from every seat inside — you trade the view for the porch.
 *
 * From the doorway anchor the range occupies roughly -1.6 to +9.9 degrees, and
 * the head of the door opening is at +13.7. The roof's far edge has to land in
 * that gap: above the peaks, at or below the door head, where the wall above
 * the opening hides it. At 3.2m out that puts the far edge near y = 4.0 and,
 * at the handoff's -0.13 rad pitch, the wall edge at 4.42 — just under the
 * 4.6m eave, which is also the only place a lean-to could actually be nailed.
 *
 * The same arithmetic settles the light, which was the other worry. A 10.7
 * degree sun rises 0.19m per metre while the roof falls 0.13m per metre, so
 * rays entering low enough to reach the floor clear the front edge easily and
 * the stripes across the boards survive intact. What the roof does block is
 * sun entering the *top* of the opening, which only ever lit the back wall.
 * That is what a porch is supposed to do.
 *
 * ## Where the posts are
 *
 * Not evenly spaced. Posts at the quarter points would stand at x = ±1.7,
 * inside the 3.6m opening, putting a column across the middle of the range. At
 * ±1.95 and ±3.05 the inner pair clears the jambs instead.
 *
 * That does not hide them, and the first version of this comment claimed it
 * would. From anywhere off the door's axis — which is most of the room, and
 * both the table and the doorway anchors — the inner posts are plainly visible
 * through the opening. Seen rather than checked, that turns out to be the
 * better picture: they put something at a known distance between you and a
 * photograph ten miles off, and the range reads as further away because of it.
 * What matters is that nothing lands in the *centre* of the opening.
 *
 * The sign hangs at x = 3.2 for the same reason, which is the position the
 * handoff gives and the reason it gives it.
 */

const P = {
  /** The deck runs from the barn's front wall out to here. */
  z0: BARN.frontZ,
  z1: BARN.frontZ - 3.2,
  x0: -3.4,
  x1: 3.4,
  deckY: 0.08,
  /** Roof at the wall, and at the outer edge. See the header comment. */
  roofWall: 4.42,
  roofEdge: 4.0,
} as const

const POSTS = [-3.05, -1.95, 1.95, 3.05]

function usePorchGeometry() {
  return useMemo(() => {
    /* Deck boards, running across the front so they read as decking. */
    const deckParts: THREE.BufferGeometry[] = []
    let z = P.z1
    let n = 0
    while (z < P.z0) {
    /*
     * Built with the length along Y and then turned down, which looks like a
     * detour and is not. `plankUVs` maps a board's length along the texture's
     * U and squeezes its width into one plank band in V, and it reads those
     * two directions off the box's own UVs — where V runs along Y. Build a
     * board lying along X and hand it its length anyway, and the mapping comes
     * out transposed: metres of board crushed into a tenth of the texture, and
     * a few centimetres of width stretched over five repeats of it.
     *
     * The result is a surface with no grain at all, which is exactly what the
     * porch deck and this ceiling have been. The porch posts were the only
     * timber out there built the correct way up, and the only timber out there
     * that had any figure in it — which is the clue, in hindsight.
     */
      const w = 0.17
      const g = plankUVs(chamferedBox(0.06, P.x1 - P.x0, w), P.x1 - P.x0, n * 31 + 21)
      g.rotateZ(Math.PI / 2)
      g.translate((P.x0 + P.x1) / 2, P.deckY, z + w / 2)
      deckParts.push(g)
      z += w + 0.009
      n++
    }
    /* Edge beam, so the deck has a thickness rather than a paper edge. */
    const edge = plankUVs(chamferedBox(0.22, P.x1 - P.x0, 0.12), P.x1 - P.x0, 77)
    edge.rotateZ(Math.PI / 2)
    edge.translate((P.x0 + P.x1) / 2, P.deckY - 0.11, P.z1 + 0.06)
    deckParts.push(edge)
    const deck = mergeGeometries(deckParts, false)
    deckParts.forEach((g) => g.dispose())

    /* Posts, and the beam they carry. */
    const frameParts: THREE.BufferGeometry[] = []
    for (const x of POSTS) {
      const h = P.roofEdge - P.deckY
      const g = plankUVs(chamferedBox(0.16, h, 0.16), h, Math.round(x * 100))
      g.translate(x, P.deckY + h / 2, P.z1 + 0.16)
      frameParts.push(g)
    }
    const beam = plankUVs(chamferedBox(0.2, P.x1 - P.x0, 0.16), P.x1 - P.x0, 5)
    beam.rotateZ(Math.PI / 2)
    beam.translate((P.x0 + P.x1) / 2, P.roofEdge - 0.1, P.z1 + 0.16)
    frameParts.push(beam)
    const frame = mergeGeometries(frameParts, false)
    frameParts.forEach((g) => g.dispose())

    /*
     * Roof boards, running down the slope. Built flat and then tilted about
     * the wall edge, so the pitch is applied once rather than baked into every
     * board's position — getting that backwards leaves the boards level and
     * the roof a staircase.
     */
    const run = P.z0 - P.z1
    const drop = P.roofWall - P.roofEdge
    const slope = Math.hypot(run, drop)
    const pitch = Math.atan2(drop, run)

    const roofParts: THREE.BufferGeometry[] = []
    let x = P.x0
    let rn = 0
    while (x < P.x1) {
      const w = 0.26
      const g = plankUVs(chamferedBox(w, slope + 0.24, 0.05), slope, rn * 31 + 13)
      g.rotateX(Math.PI / 2)
      g.rotateX(-pitch)
      g.translate(x + w / 2, (P.roofWall + P.roofEdge) / 2, (P.z0 + P.z1) / 2 - 0.1)
      roofParts.push(g)
      x += w + 0.006
      rn++
    }
    const roof = mergeGeometries(roofParts, false)
    roofParts.forEach((g) => g.dispose())

    return { deck, frame, roof }
  }, [])
}

/** The board over the door, painted years ago and touched up since. */
function Sign() {
  const map = useMemo(() => {
    const t = new THREE.CanvasTexture(signTexture())
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])

  return (
    <group position={[3.2, P.roofEdge - 0.22, P.z1 + 0.3]}>
      {/* Two short chains from the beam. */}
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.16, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.3, 6]} />
          <meshStandardMaterial color="#2a241d" roughness={0.8} metalness={0.5} />
        </mesh>
      ))}
      {/*
       * Faced both ways. It reads from the porch and from inside the doorway,
       * and a one-sided sign is invisible from exactly the angle most visitors
       * arrive at.
       */}
      <mesh castShadow>
        <boxGeometry args={[1.05, 0.42, 0.035]} />
        <meshStandardMaterial map={map} roughness={0.86} />
      </mesh>
    </group>
  )
}

export function Porch() {
  const { deck, frame, roof } = usePorchGeometry()
  const furniture = useWoodMaps(GRAIN.furniture)

  /*
   * Silvered, and genuinely so rather than tinted so.
   *
   * This carried `tint: '#b9b3a8'` and a comment about a century of weather,
   * and rendered near-black — darker at midday than the floor inside the
   * building, with the whole valley of snow bouncing light onto it. A tint
   * multiplies the albedo map and multiplication cannot lighten; the source
   * set is dark timber, so no tint was ever going to get there. See coats.ts:
   * the pale is composited into the albedo, which is also what actually
   * happens to a board left outside for a hundred years.
   */
  const boards = useSilvered(GRAIN.siding)
  /*
   * The posts weather too — less than the deck, because they shed rain rather
   * than hold it, and because half of each one is under the roof. Left on the
   * barn's timber they were dark brown against a silver deck, which is two
   * different buildings.
   */
  const timber = useSilvered(GRAIN.siding, 0.3)
  const seat = useWoodMaterial(furniture, { tint: '#a89478', roughness: 0.8 })

  return (
    <group>
      <mesh geometry={deck} material={boards} castShadow receiveShadow />
      <mesh geometry={frame} material={timber} castShadow receiveShadow />
      <mesh geometry={roof} material={boards} castShadow receiveShadow />

      {/* The bench, against the wall, out of the doorway. */}
      <group position={[-2.3, 0, BARN.frontZ - 0.62]}>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.07, 0.42]} />
          <primitive object={seat} attach="material" />
        </mesh>
        <mesh position={[0, 0.86, -0.19]} castShadow>
          <boxGeometry args={[1.7, 0.55, 0.06]} />
          <primitive object={seat} attach="material" />
        </mesh>
        {[-0.72, 0.72].map((x) => (
          <mesh key={x} position={[x, 0.3, 0]} castShadow>
            <boxGeometry args={[0.09, 0.44, 0.38]} />
            <primitive object={seat} attach="material" />
          </mesh>
        ))}
      </group>

      <Sign />
    </group>
  )
}
