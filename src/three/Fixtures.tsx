import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { GRAIN, useWoodMaps, useWoodMaterial } from './wood'
import { useSacking, useSoapstone } from './surfaces'
import { Board } from './Board'
import { EspressoMachine } from './EspressoMachine'
import { Stove } from './Stove'
import { Cup, Saucer } from './Crockery'
import { Table } from './Table'
import { useTableTop } from './tabletop'
import { Grinder } from './Grinder'
import { Stool } from './Stool'
import type { SceneLight } from './lighting'

/**
 * What is in the barn.
 *
 * The furniture is deliberately sparse. A converted homestead barn is mostly
 * air and roof, and filling it with props would fight the one thing the space
 * has going for it, which is volume.
 */

/**
 * Furniture timber: the building's PBR set, run at its own grain scale.
 *
 * The scale is the point. Sharing the barn's mapping put identical knots at
 * identical size on the tabletop and the floorboards under it, and from a
 * seated camera the two stopped being separate objects — the cup and the
 * notebook read as sitting on the floor. Planed furniture timber shows a finer
 * figure than a floor anyway, so the fix and the truth agree.
 */
function useFurnitureWood(color: string, roughness = 0.85) {
  const maps = useWoodMaps(GRAIN.furniture)
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

/** What was ordered and where it landed, once it has arrived. */
export type Served = { tray: [number, number, number]; kind: 'drink' | 'pastry' } | null

export function Fixtures({
  light,
  bulbsOn,
  onToggleBulbs,
  radioLabel,
  onToggleRadio,
  served,
  grinding,
}: {
  light: SceneLight
  bulbsOn: boolean
  onToggleBulbs: () => void
  radioLabel: string
  onToggleRadio?: () => void
  served?: Served
  grinding?: boolean
}) {
  const stone = useSoapstone()
  const sacking = useSacking()
  const carcass = useFurnitureWood('#4a3a28')
  // Clearly paler than the floor. Planed fir that has been waxed and wiped
  // down twice a day is not the same colour as a hundred-year-old barn floor,
  // and at midday, with the light flat, tone is the only thing separating
  // them — grain scale alone does it at dusk and not at noon.
  const tableTop = useFurnitureWood('#bda06f', 0.55)
  /* The back shelf and the pastry board stay timber: a stone top dropped onto
   * a carpenter's carcass is what a real conversion looks like. */
  const shelfTop = useFurnitureWood('#6b543a', 0.7)
  /*
   * A worn top per table. See tabletop.ts — boards laid out for real, a
   * polished middle, and cup rings placed on the table rather than tiled.
   * Yours is the one you sit 60cm from, so it gets four times the pixels of
   * the three you only see from across the room.
   */
  const mine = useTableTop(3, 0.62, 1024)
  const byTheDoor = useTableTop(11, 0.55)
  const byTheStove = useTableTop(5, 0.5)
  const byTheCounter = useTableTop(8, 0.55)

  return (
    <group>
      {/* Counter along the north wall. */}
      <group position={[4.1, 0, 1]}>
        {/* Soapstone slab. See surfaces.ts — the one surface in the room that
            is not the barn's timber, and the reason the counter stop stopped
            reading as a piece of floor stood on its side. */}
        <mesh position={[0, 1.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.08, 4.4]} />
          <primitive object={stone} attach="material" />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 1.0, 4.2]} />
          <primitive object={carcass} attach="material" />
        </mesh>

        {/*
         * The name, on the wall above the shelf.
         *
         * The board on the porch is the one you walk under; this is the one
         * you read while you wait, which is a different job and wants a
         * different board — bolder, two lines, bigger letters, because it is
         * seen from across a room rather than from two metres under a roof.
         *
         * Hung on the north wall at x = 6 rather than on the shelf, turned a
         * quarter to face back into the room. Edges are the counter carcass
         * timber: a sign nailed up in a working barn was cut from whatever
         * was to hand, which here is the same stock the counter is.
         *
         * Placed by angle rather than by eye, in two corrections.
         *
         * It went up over the middle of the counter first, which is where you
         * would hang it standing in the room. From the counter station that
         * is 40 degrees off the camera axis, so a sliver appeared in the top
         * right corner and nothing else — the axis from that station never
         * reaches this wall inside the building, because it looks *down* the
         * room and the wall runs beside it. Moving it back past the end of
         * the counter, to z = -1.45, brings it to 18 degrees and into the
         * right third of the frame.
         *
         * Then it has to thread a gap, which is the part worth writing down.
         * Dropped to 2.25m at the same time, it landed squarely behind the
         * row of bean jars on the shelf — which stand two metres nearer the
         * camera, so their 22cm covers far more of the frame than their size
         * suggests. Lifted clear of those, it ran off the top of the picture
         * instead, because this station is pitched 5.6 degrees down and that
         * comes straight off the available headroom. Both failures were the
         * same mistake: judging a wall position by where it is on the wall.
         *
         * And then there is a third thing in the way, which is the building.
         * Barn.tsx stands a 200mm frame post against this wall every few
         * metres — at z = -4, -1, 1.5, 4 and 6 — and they sit proud of the
         * siding, so the board has to live in a bay rather than anywhere on
         * the wall. Centred at z = -2.5 it is in the middle of the widest
         * one, and the sight line from the counter crosses the post plane at
         * z = -2.20, clear of both neighbours.
         *
         * The rest is arithmetic. The jar on the sight line is 2.11m high at
         * 3.88m out, so it cuts everything below 7.5 degrees; the frame's top
         * edge is at camera pitch plus half the vertical fov, 17.1 degrees.
         * At 6.82m out those bracket 2.50m and 3.70m — 1.20m of usable wall,
         * so a 0.645m board centred at 3.10 clears both with 28cm either side.
         *
         * Where a sign *would* hang and where a sign can be *seen* are
         * different questions in a room with five fixed viewpoints, and only
         * the second one decides anything.
         */}
        <Board
          edge={carcass}
          front="textures/sign/counter.jpg"
          /* Built lying in XY — the map lives on the ±Z faces, so the board
             has to be 1.24 wide and 0.04 thick *before* the quarter turn, not
             after it. Sized the other way round the lettering lands on the
             sawn edge. */
          size={[1.0, 0.645, 0.04]}
          position={[1.85, 3.1, -3.5]}
          rotation={[0, -Math.PI / 2, 0]}
          castShadow
        />

        {/* Back shelf with the day's beans and a row of cups. */}
        <mesh position={[0.75, 1.85, 0]} castShadow>
          <boxGeometry args={[0.34, 0.05, 3.4]} />
          <primitive object={shelfTop} attach="material" />
        </mesh>
        {[-1.2, -0.75, -0.3].map((z) => (
          <mesh key={z} position={[0.75, 2.0, z]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.22, 14]} />
            <meshStandardMaterial color="#2e2116" roughness={0.85} />
          </mesh>
        ))}
        {/* Cups turned upside down on the shelf, as they are left to drain.
            Each one turned to its own bearing — a row of handles all pointing
            the same way is the tell that they were placed by a loop. */}
        {[0.4, 0.72, 1.04, 1.36].map((z, i) => (
          <Cup
            key={z}
            position={[0.75, 1.875, z]}
            scale={0.92}
            coffee={false}
            rotation={0.9 + i * 1.7}
          />
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
      <Table position={[0.9, 0, 3.1]} radius={0.62} seed={3} top={tableTop} face={mine} frame={carcass}>

        {/*
         * The table top sits at 0.77; everything on it is measured off that,
         * not guessed, or the crockery floats. The coffee surface is set well
         * below the rim so it does not z-fight the cup it is sitting in.
         */}
        {/*
         * See Crockery.tsx. This is the nearest object to the seated camera in
         * the whole building, so it is the one place where the rim having
         * thickness and the cup standing on a foot ring are worth the points.
         * The cup sits 6.5mm up, in the saucer's well, not on the table.
         */}
        <Interactive label="yours, still hot">
          <Saucer position={[0.14, 0.77, 0.06]} />
          <Cup position={[0.14, 0.7765, 0.06]} rotation={0.5} />
        </Interactive>
        <Steam position={[0.14, 0.85, 0.06]} />

        {/* Someone's notebook, left open. */}
        <mesh position={[-0.26, 0.779, -0.06]} rotation={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.3, 0.018, 0.22]} />
          <meshStandardMaterial color="#8c7c60" roughness={0.9} />
        </mesh>
      </Table>

      {/* A second table, empty, closer to the door. */}
      <Table
        position={[-3.2, 0, 0.4]}
        radius={0.55}
        rotation={0.9}
        seed={11}
        top={tableTop}
        face={byTheDoor}
        frame={carcass}
      >
        {[0, Math.PI * 0.7].map((a, i) => (
          <Stool
            key={i}
            position={[Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0]}
            rotation={2.1 - a}
            seat={tableTop}
            leg={carcass}
          />
        ))}
      </Table>

      {/* Bulbs strung down the ridge. Click any of them. */}
      <Interactive label={bulbsOn ? 'put them out' : 'light them'} onClick={onToggleBulbs}>
        {[-1.6, 0.8, 3.2].map((z) => (
          <Bulb key={z} z={z} on={bulbsOn} light={light} />
        ))}
      </Interactive>

      {/*
       * The rest of the café. The route now stops at the counter and the wall,
       * so what used to be distant scenery is somewhere you stand — and an
       * empty room at arm's length reads as a set rather than a shop.
       */}

      {/*
       * The machine, and the grinder beside it. See EspressoMachine.tsx — it
       * is modelled from lathed profiles rather than downloaded, because every
       * CC0 source is unreachable from this network.
       */}
      <group position={[4.08, 1.1, -0.4]}>
        <EspressoMachine />
      </group>

      {/* The grinder, beside it. See Grinder.tsx. */}
      <group position={[4.05, 1.1, 0.42]}>
        <Grinder grinding={!!grinding} />
      </group>

      {/* Pastry dome, and what is under it. */}
      <group position={[4.0, 1.14, 2.3]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 26]} />
          <primitive object={shelfTop} attach="material" />
        </mesh>
        {[[-0.07, 0.04], [0.06, -0.05], [0.02, 0.08]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.07, z]} rotation={[0, i * 1.1, 0]} castShadow>
            <capsuleGeometry args={[0.035, 0.05, 4, 10]} />
            <meshStandardMaterial color="#a8712f" roughness={0.72} />
          </mesh>
        ))}
        <mesh position={[0, 0.14, 0]}>
          <sphereGeometry args={[0.21, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.06}
            metalness={0}
            transmission={0.92}
            thickness={0.02}
            ior={1.5}
            transparent
          />
        </mesh>
      </group>

      {/*
       * Sacks of green coffee behind the counter, on a pallet.
       *
       * Four, each its own weave and its own height. A full sack is taller
       * than a half-empty one, and identical capsules in a row are the kind
       * of repetition the eye picks out before it has worked out what it is
       * looking at — the same reason the tables each got their own worn top.
       * See useSacking() in surfaces.ts.
       *
       * The pallet is not dressing. Sitting straight on the boards, the stack
       * was almost entirely behind the counter from the only station that
       * looks at it: the sight line from the counter clears the slab's far
       * edge at y = 0.95, so a sack resting on the floor showed 28cm of dome
       * and the other three showed nothing at all. Four weaves nobody can see
       * is 200KB of texture spent on a private joke.
       *
       * Lifting them is also simply what happens to sacks — green coffee goes
       * on a pallet because a jute sack on a cold floor wicks damp straight
       * into the beans, and every store room that has ever held any does this.
       * Two on the deck and two on top puts the upper pair above the counter
       * line with half their height showing.
       */}
      <group position={[5.3, 0, -1.4]}>
        {/* Four slats and two bearers. */}
        <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.12, 0.045, 0.84]} />
          <primitive object={carcass} attach="material" />
        </mesh>
        {[-0.3, 0.3].map((z) => (
          <mesh key={z} position={[0, 0.05, z]} castShadow>
            <boxGeometry args={[1.08, 0.095, 0.1]} />
            <primitive object={carcass} attach="material" />
          </mesh>
        ))}

        {[
          // Deck of the pallet is at 0.1425; a sack's half-height is
          // 0.39 * squash, so each centre is that much above whatever it
          // stands on.
          { at: [-0.2, 0.533, -0.18] as const, turn: 0.0, lean: 0, squash: 1.0 },
          { at: [0.18, 0.502, -0.12] as const, turn: 0.7, lean: 0, squash: 0.92 },
          { at: [-0.14, 1.258, 0.1] as const, turn: 1.4, lean: 0.1, squash: 0.86 },
          { at: [0.2, 1.236, 0.16] as const, turn: 2.3, lean: -0.06, squash: 0.96 },
        ].map((k, i) => (
          <mesh
            key={i}
            position={[k.at[0], k.at[1], k.at[2]]}
            rotation={[0, k.turn, k.lean]}
            scale={[1, k.squash, 1]}
            material={sacking[i]}
            castShadow
            receiveShadow
          >
            <capsuleGeometry args={[0.24, 0.3, 4, 16]} />
          </mesh>
        ))}
      </group>

      {/* Two more tables down the room, with stools. */}
      {[
        { at: [-3.4, 0, 3.4] as const, r: 0.5, turn: 2.0, seed: 5, face: byTheStove },
        { at: [3.0, 0, 4.2] as const, r: 0.55, turn: 0.35, seed: 8, face: byTheCounter },
      ].map((t, i) => (
        <Table
          key={i}
          position={[t.at[0], t.at[1], t.at[2]]}
          radius={t.r}
          rotation={t.turn}
          seed={t.seed}
          top={tableTop}
          face={t.face}
          frame={carcass}
        >
          {[0.6, 2.4, 4.3].map((a, j) => (
            <Stool
              key={j}
              position={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]}
              rotation={a * 1.3 + i}
              seat={tableTop}
              leg={carcass}
            />
          ))}
        </Table>
      ))}

      {/*
       * The board they took down, leaning against the front wall by the door.
       *
       * Every sign-written premises open longer than a decade has one of
       * these somewhere: the previous board, too good to burn and not good
       * enough to hang. It is also the only honest thing to do with a second
       * painting of the same two words — four identical signs in one small
       * building reads as a brand, and a brand is the opposite of what this
       * is.
       *
       * Inside rather than on the porch, which is where it first went. The
       * porch has exactly one camera station, it stands at the wall facing
       * out at the plain, and nothing against that wall is in its frame at
       * any angle — so the board was a correctly-built object that no visitor
       * could ever have seen. Here it is 17 degrees off the axis of the
       * opening shot, low and left, with the chalkboard answering it on the
       * right.
       *
       * Leaned twelve degrees, bottom out, so the face points up into the
       * room. One face: the reverse is against the siding.
       */}
      <group position={[-2.55, 0, -3.84]} rotation={[-0.2, 0, 0]}>
        <Board
          edge={carcass}
          front="textures/sign/spare.jpg"
          size={[1.15, 0.605, 0.03]}
          position={[0, 0.303, 0]}
          castShadow
          receiveShadow
        />
      </group>

      {/* A bench along the south wall. */}
      <group position={[-5.5, 0, 2.2]}>
        <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.07, 3.2]} />
          <primitive object={tableTop} attach="material" />
        </mesh>
        <mesh position={[-0.18, 0.9, 0]} castShadow>
          <boxGeometry args={[0.08, 0.8, 3.2]} />
          <primitive object={carcass} attach="material" />
        </mesh>
        {[-1.4, 0, 1.4].map((z) => (
          <mesh key={z} position={[0, 0.22, z]} castShadow>
            <boxGeometry args={[0.42, 0.44, 0.09]} />
            <primitive object={carcass} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Firewood stacked by the stove. */}
      {Array.from({ length: 14 }, (_, i) => {
        const row = Math.floor(i / 5)
        const col = i % 5
        return (
          <mesh
            key={i}
            position={[-5.2 + col * 0.005, 0.09 + row * 0.16, 3.0 + col * 0.17]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.075, 0.085, 0.42, 9]} />
            <primitive object={carcass} attach="material" />
          </mesh>
        )
      })}

      {/*
       * What you ordered, once it has arrived.
       *
       * Placed in world space rather than parented to a table, because it can
       * land on any of four seats or on the counter, and the seat data already
       * carries the coordinate. A drink gets its own steam source; a pastry
       * does not, which is most of what distinguishes them at this size.
       */}
      {served && (
        <group position={served.tray}>
          {served.kind === 'drink' ? (
            <>
              <Saucer />
              <Cup position={[0, 0.0065, 0]} rotation={-0.7} />
              <Steam position={[0, 0.08, 0]} />
            </>
          ) : (
            <mesh position={[0, 0.036, 0]} rotation={[0, 0.6, 0]} castShadow receiveShadow>
              <capsuleGeometry args={[0.036, 0.055, 4, 12]} />
              <meshStandardMaterial color="#a8712f" roughness={0.72} />
            </mesh>
          )}
        </group>
      )}

      {/* Wood stove in the corner — the reason the place is habitable. */}
      <group position={[-4.4, 0, 4.2]} rotation={[0, -0.34, 0]}>
        <Stove light={light} />
      </group>
    </group>
  )
}
