import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Conifers in the middle ground.
 *
 * The trees in this scene were the photograph, and the photograph cannot hold
 * them. Measured: after its crop the plate is 2842 × 1063, an aspect of 2.67,
 * and it is mapped onto 170° of arc by 23.7° of elevation — an angular aspect
 * of 7.18. Everything on it is therefore stretched **2.69× wide**. On the
 * range that is survivable, because mountains are large soft forms and nobody
 * knows how wide that ridge is meant to be. On the tree line it is fatal:
 * conifers are nothing but fine vertical detail, which is precisely what
 * horizontal smearing destroys, and from the porch the nearest trees read as
 * green horizontal streaks.
 *
 * The stretch cannot be fixed on the plate. An undistorted mapping of this
 * photograph at this magnification would cover 63° of arc, not 170°, so
 * either the panorama stops well inside the field of view or the range gets
 * three times smaller. Both are composition decisions, not bugs.
 *
 * What can be fixed is which trees you are looking at. Real ones between 15
 * and 55 metres put crisp, correctly-proportioned conifers in front of the
 * smeared ones, and the plate's tree line drops back into being what it
 * should have been all along — a distant hazy edge to the valley. It also
 * buys the one depth cue the backdrop can never give: walk two metres along
 * the porch and these move against the mountains, because they are actually
 * there.
 *
 * They are cheap on purpose. No shadows — the sun's shadow camera is a tight
 * frustum around the barn and none of this is inside it, so casting would
 * cost and show nothing — and about a hundred tris a tree, merged into two
 * draw calls.
 */

const COUNT = 120
const NEAR = 15
const FAR = 58

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * Whether a tree may stand here.
 *
 * Two exclusions. The building and its porch and bakery, obviously. And a
 * widening corridor straight out of the door, because the range framed in
 * that opening is the reason the barn faces the way it does — trees across it
 * at twenty metres would be scenery in front of the view rather than the way
 * to it. Past forty metres the corridor closes and trees are welcome, since
 * by then they read as the far side of the meadow.
 */
function allowed(x: number, z: number): boolean {
  if (Math.abs(x) < 9.5 && z > -10.5 && z < 12) return false
  if (z < -8) {
    const depth = -z
    if (depth < 40 && Math.abs(x) < 8 + depth * 0.32) return false
  }
  return true
}

/**
 * One spruce, as a lathe with a serrated profile.
 *
 * The first version stacked five to seven cones of decreasing radius, which
 * is the obvious way and is wrong in a way that is instantly recognisable:
 * you can see every cone's base as a hard step, and the result is a Christmas
 * decoration. Concentric cones with gaps between them is not what a tree
 * looks like from any distance.
 *
 * A spruce's outline is a single continuous taper with a *serrated* edge —
 * whorls of branches sticking out past the general profile, each drooping a
 * little at the tip. That is one lathe: run the profile from the skirt to the
 * leader, and at each whorl step out to the branch tip and back in to the
 * trunk. Rotationally symmetric, which for a conifer is correct, and it gives
 * the same ragged silhouette from every bearing for a fifth of the geometry.
 *
 * The skirt also comes much closer to the ground than it did. A spruce
 * standing alone in a meadow keeps its lower branches — bare trunk under a
 * ball of foliage is what a tree in a *forest* looks like, where the bottom
 * has been shaded out, and this is not a forest.
 */
function spruce(h: number, rand: () => number) {
  const trunkH = h * 0.2
  const trunk = new THREE.CylinderGeometry(h * 0.012, h * 0.026, trunkH, 6)
  trunk.translate(0, trunkH / 2, 0)

  const skirt = h * 0.08
  const span = h - skirt
  const R = h * 0.2 * (0.82 + rand() * 0.4)
  const whorls = 9 + Math.floor(rand() * 4)

  const pts: THREE.Vector2[] = [new THREE.Vector2(0, skirt * 0.4)]
  let t = 0
  for (let i = 0; i < whorls; i++) {
    // Uneven spacing. Whorls mark years, and no tree has had the same year
    // twice; evenly spaced ones read as a machined thread, which is exactly
    // what the first pass looked like at any magnification.
    t += (1 / whorls) * (0.65 + rand() * 0.7)
    if (t >= 1) break
    // ^1.15 rather than linear: a spruce is fullest low down and the taper
    // tightens toward the leader.
    const r = R * Math.pow(1 - t, 1.15) * (0.76 + rand() * 0.48)
    const y = skirt + t * span
    // The branch tip sits *below* where it leaves the trunk, because branches
    // droop, and that downward tick is most of what reads as a conifer.
    pts.push(new THREE.Vector2(r, y - span * 0.02))
    pts.push(new THREE.Vector2(r * (0.28 + rand() * 0.16), y + span * (0.5 / whorls)))
  }
  // A leader, not a spire. Running the profile to a single point at the full
  // height gave every tree a long needle-thin spike on top.
  pts.push(new THREE.Vector2(R * 0.05, h * 0.94))
  pts.push(new THREE.Vector2(0, h))

  const foliage = new THREE.LatheGeometry(pts, 9)
  foliage.rotateY(rand() * Math.PI * 2)
  return { trunk, foliage }
}

/**
 * Needles, with the winter on them.
 *
 * Drawn broad rather than fine. The nearest of these is fifteen metres away
 * and most are past thirty, so needle-scale detail is below a pixel and all
 * that survives is the large-scale mottle — dark where the canopy is deep,
 * pale where snow is sitting on a branch. Painting actual needles would cost
 * the same and be invisible.
 */
function useNeedles() {
  return useMemo(() => {
    const S = 512
    const c = document.createElement('canvas')
    c.width = c.height = S
    const ctx = c.getContext('2d')!
    const rand = seeded(31771)

    // Green, and not just dark. Spruce needles are blue-green and the first
    // passes chased value until the stand was dark but achromatic — a row of
    // grey cut-outs, which against a grey-white snowfield has nothing to say.
    ctx.fillStyle = '#16291c'
    ctx.fillRect(0, 0, S, S)

    /*
     * Sparing with the snow. The first pass put a pale blob on nearly four
     * blobs in ten and the stand came back the same value as the snowfield
     * behind it — a row of pale sage cut-outs. Conifers against snow are
     * close to black; that contrast is most of what they contribute to a
     * winter frame, and any snow-load bright enough to see from the porch is
     * too much.
     */
    for (let i = 0; i < 260; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 6 + rand() * 54
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      const snow = rand() > 0.87
      g.addColorStop(
        0,
        snow
          ? `rgba(188,198,206,${0.1 + rand() * 0.18})`
          : `rgba(${12 + rand() * 12},${26 + rand() * 20},${18 + rand() * 12},0.55)`,
      )
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    /*
     * And an alpha map, which is what stops these being solid objects.
     *
     * A lathe gives a hard geometric zigzag, and no amount of jitter in the
     * profile hides that it is a surface of revolution with a clean edge. A
     * conifer has no clean edge anywhere: it is a cloud of needles you can see
     * sky through, and its outline frays. Punching irregular holes through the
     * canopy costs one texture and an alphaTest — no sorting, no transparency
     * — and it breaks the silhouette everywhere at once, which is the one
     * thing the geometry cannot do for itself.
     *
     * The holes are kept coarse deliberately. Fine ones alias into a crawling
     * speckle at the distances these are seen from, which is worse than a
     * hard edge.
     */
    const ac = document.createElement('canvas')
    ac.width = ac.height = S
    const actx = ac.getContext('2d')!
    actx.fillStyle = '#ffffff'
    actx.fillRect(0, 0, S, S)
    for (let i = 0; i < 300; i++) {
      const x = rand() * S
      const y = rand() * S
      const r = 5 + rand() * 26
      const g = actx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(0,0,0,${0.55 + rand() * 0.45})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      actx.fillStyle = g
      actx.beginPath()
      actx.ellipse(x, y, r, r * (0.5 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2)
      actx.fill()
    }

    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    const alphaMap = new THREE.CanvasTexture(ac)
    alphaMap.colorSpace = THREE.NoColorSpace
    for (const t of [map, alphaMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(3, 3)
      t.anisotropy = 4
    }
    return new THREE.MeshStandardMaterial({
      map,
      alphaMap,
      alphaTest: 0.42,
      // Both sides, because half of what you now see through the canopy is
      // the inside of the far branches.
      side: THREE.DoubleSide,
      roughness: 1,
      metalness: 0,
      // Per-tree tone, baked in at merge time. See below.
      vertexColors: true,
      // Conifers are almost black at distance and the environment map is a
      // bright winter sky; left at 1 they came back as glossy shrubs.
      envMapIntensity: 0.14,
    })
  }, [])
}

export function Trees() {
  const needles = useNeedles()

  const bark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Nearly black. A spruce trunk at twenty metres in snow-glare is a
        // dark line; the first pass tinted it toward the sun and every tree
        // came back standing on a white pole.
        color: '#221d18',
        roughness: 1,
        metalness: 0,
        envMapIntensity: 0.2,
      }),
    [],
  )

  const { trunks, canopy } = useMemo(() => {
    const rand = seeded(20260101)
    const trunkParts: THREE.BufferGeometry[] = []
    const leafParts: THREE.BufferGeometry[] = []

    let placed = 0
    let tries = 0
    while (placed < COUNT && tries < COUNT * 40) {
      tries++
      const a = rand() * Math.PI * 2
      // sqrt, so the ring fills evenly by area rather than crowding the middle.
      const r = Math.sqrt(NEAR * NEAR + rand() * (FAR * FAR - NEAR * NEAR))
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (!allowed(x, z)) continue

      /*
       * Clumped, not scattered. Spruce grow in stands, and an even sprinkle
       * of single trees across a meadow is the giveaway of a placement loop.
       * Every third one seeds a stand and the next few crowd around it.
       */
      const clump = rand() < 0.45 ? 1 + Math.floor(rand() * 4) : 1
      for (let k = 0; k < clump && placed < COUNT; k++) {
        const ox = k === 0 ? 0 : (rand() - 0.5) * 7
        const oz = k === 0 ? 0 : (rand() - 0.5) * 7
        if (!allowed(x + ox, z + oz)) continue
        const h = 3.2 + Math.pow(rand(), 1.6) * 12
        const { trunk, foliage } = spruce(h, rand)

        /*
         * A tone per tree, written into vertex colours.
         *
         * One material across a merged stand means every tree is the same
         * green, and a hundred identical greens is the thing that says these
         * were placed by a loop. There is no per-instance colour on a merged
         * geometry, but there is a colour attribute, and filling one per tree
         * before the merge costs nothing at run time. Real stands vary by
         * age, species and how much snow is sitting in them.
         */
        const tone = 0.56 + rand() * 0.62
        // A few stand browner than the rest, the way a stand always has one
        // that is dying and two that are a different species.
        const warm = 0.9 + rand() * (rand() < 0.16 ? 0.5 : 0.16)
        const n = foliage.attributes.position.count
        const col = new Float32Array(n * 3)
        for (let v = 0; v < n; v++) {
          col[v * 3] = tone * warm
          col[v * 3 + 1] = tone
          col[v * 3 + 2] = tone * (2 - warm) * 0.96
        }
        foliage.setAttribute('color', new THREE.BufferAttribute(col, 3))

        for (const g of [trunk, foliage]) {
          g.rotateY(rand() * Math.PI * 2)
          // A degree or two off plumb. Nothing outdoors is upright.
          g.rotateZ((rand() - 0.5) * 0.055)
          // Set a little into the snow, which is where a trunk goes.
          g.translate(x + ox, -0.18, z + oz)
        }
        trunkParts.push(trunk)
        leafParts.push(foliage)
        placed++
      }
    }

    const trunks = mergeGeometries(trunkParts, false)!
    const canopy = mergeGeometries(leafParts, false)!
    trunkParts.forEach((g) => g.dispose())
    leafParts.forEach((g) => g.dispose())
    return { trunks, canopy }
  }, [])

  /*
   * Not tinted with the hour, which the first pass did and should not have.
   * These are MeshStandardMaterials out in the open: the sun, the ambient and
   * the bounce already carry the time of day to them, exactly as they carry
   * it to the snow they are standing in. Multiplying the hour in a second
   * time on the material's own colour double-counted it, and at midday it
   * washed the whole stand pale.
   */

  return (
    <group>
      <mesh geometry={trunks} material={bark} />
      <mesh geometry={canopy} material={needles} />
    </group>
  )
}
