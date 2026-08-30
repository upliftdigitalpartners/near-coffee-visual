import * as THREE from 'three'

/**
 * Where you are allowed to stand.
 *
 * The handoff constrains movement to a handful of axis-aligned zones rather
 * than doing real collision, and that is the right trade for this: a barn is a
 * few rectangles, and a swept-capsule solver against three hundred siding
 * boards would cost more than the whole rest of the frame.
 *
 * A position is legal if it is inside any zone. When it is not, it is pushed to
 * the nearest point of the nearest zone, which is what makes walking into a
 * wall *slide along it* rather than stop dead — the component of the movement
 * along the wall survives the clamp.
 *
 * Blockers are the exception the handoff does not have. Zones alone let you
 * walk through the stove and out the other side, and one pass through a cast
 * iron stove undoes more of the illusion than any amount of shader work
 * rebuilds. They are the same rectangles, subtracted.
 */

export type Rect = {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** A place you can be, and how high the floor is under it. */
export type Zone = Rect & { floorY: number; name: string }

/**
 * Walkable floor.
 *
 * The café floor deliberately stops at x = 3.4, short of the counter at 3.6.
 * Customers do not go behind the counter, and making the service side
 * unreachable is both truer and cheaper than modelling its back.
 */
export const ZONES: Zone[] = [
  { name: 'cafe', x0: -5.5, x1: 3.4, z0: -3.5, z1: 5.5, floorY: 0 },
  { name: 'doorway', x0: -1.65, x1: 1.65, z0: -4.5, z1: -3.5, floorY: 0 },
  { name: 'porch', x0: -3.3, x1: 3.3, z0: -7.05, z1: -4.5, floorY: 0.08 },
  /* The gap in the back wall, and the bakery behind it. */
  { name: 'hatch', x0: 1.6, x1: 3.2, z0: 5.5, z1: 6.3, floorY: 0 },
  { name: 'bakery', x0: 0.5, x1: 4.2, z0: 6.3, z1: 9.5, floorY: 0 },
]

/** Things you should not be able to walk through. */
export const BLOCKERS: Rect[] = [
  /* Wood stove and its flue, plus a little clearance — it is 500°C. */
  { x0: -5.0, x1: -3.8, z0: 3.6, z1: 4.8 },
  /* The stacked firewood beside it. */
  { x0: -5.5, x1: -4.7, z0: 2.8, z1: 3.9 },
  /* Bench along the south wall. */
  { x0: -5.5, x1: -5.0, z0: 0.6, z1: 3.8 },
  /* Tables, with their chairs. Walking through a table is the tell. */
  { x0: 0.1, x1: 1.7, z0: 2.3, z1: 3.9 },
  { x0: -4.0, x1: -2.4, z0: -0.4, z1: 1.2 },
  { x0: -4.2, x1: -2.6, z0: 2.6, z1: 4.2 },
  { x0: 2.3, x1: 3.4, z0: 3.4, z1: 5.0 },
  /* The porch bench, and the four posts holding the roof up. */
  { x0: -3.2, x1: -1.4, z0: -4.9, z1: -4.3 },
  { x0: -3.2, x1: -2.9, z0: -7.0, z1: -6.7 },
  { x0: -2.1, x1: -1.8, z0: -7.0, z1: -6.7 },
  { x0: 1.8, x1: 2.1, z0: -7.0, z1: -6.7 },
  { x0: 2.9, x1: 3.2, z0: -7.0, z1: -6.7 },
  /* Bakery: the deck oven, and the work bench down the middle. */
  { x0: 2.6, x1: 4.2, z0: 8.4, z1: 9.5 },
  { x0: 0.6, x1: 2.2, z0: 7.0, z1: 8.6 },
]

function insideRect(r: Rect, x: number, z: number, pad = 0): boolean {
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad
}

/** Squared distance from a point to a rectangle, zero inside it. */
function distToRect(r: Rect, x: number, z: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1)
  const dz = Math.max(r.z0 - z, 0, z - r.z1)
  return dx * dx + dz * dz
}

/** Push a point out of a blocker, by whichever side is nearest. */
function pushOut(r: Rect, x: number, z: number, pad: number): [number, number] {
  const left = x - (r.x0 - pad)
  const right = r.x1 + pad - x
  const back = z - (r.z0 - pad)
  const front = r.z1 + pad - z
  const m = Math.min(left, right, back, front)
  if (m === left) return [r.x0 - pad, z]
  if (m === right) return [r.x1 + pad, z]
  if (m === back) return [x, r.z0 - pad]
  return [x, r.z1 + pad]
}

/** The zone a point is in, or null. */
export function zoneAt(x: number, z: number): Zone | null {
  for (const zone of ZONES) if (insideRect(zone, x, z)) return zone
  return null
}

/**
 * The nearest place you are allowed to be.
 *
 * `pad` keeps the camera off the walls; standing with your eye exactly on the
 * plane of the siding lets the near plane clip through it and you see the
 * valley from inside the wall.
 */
export function clampToZones(x: number, z: number, pad = 0.32): [number, number] {
  let best: Zone | null = null
  let bestD = Infinity
  for (const zone of ZONES) {
    const d = distToRect(zone, x, z)
    if (d < bestD) {
      bestD = d
      best = zone
    }
    if (d === 0) break
  }
  if (!best) return [x, z]

  /*
   * Clamped per axis rather than to the nearest corner, which is what lets a
   * walk into a wall keep its sideways component and slide.
   */
  let cx = THREE.MathUtils.clamp(x, best.x0 + pad, best.x1 - pad)
  let cz = THREE.MathUtils.clamp(z, best.z0 + pad, best.z1 - pad)

  /*
   * A zone narrower than two pads inverts its own clamp — min ends up above
   * max — and the camera snaps to the middle of the doorway and sticks there.
   */
  if (best.x1 - best.x0 < pad * 2) cx = (best.x0 + best.x1) / 2
  if (best.z1 - best.z0 < pad * 2) cz = (best.z0 + best.z1) / 2

  for (const b of BLOCKERS) {
    if (insideRect(b, cx, cz, pad)) {
      ;[cx, cz] = pushOut(b, cx, cz, pad)
    }
  }
  return [cx, cz]
}

/** Floor height where you are standing. Everything is one level, for now. */
export function floorAt(x: number, z: number): number {
  return zoneAt(x, z)?.floorY ?? 0
}
