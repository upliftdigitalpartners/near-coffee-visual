/**
 * The building's dimensions.
 *
 * A Mormon Row homestead barn, of the kind standing in Grand Teton National
 * Park a couple of miles off the Snake River. Units are metres. The door
 * faces -Z, which is west, so the evening sun comes straight in through the
 * opening and along the gaps in the south wall.
 *
 * These live apart from Barn.tsx, which draws it, so that macro.ts can
 * measure the floor without importing the component. It could not: Barn.tsx
 * imports the wear layer, the wear layer needs the barn's extents at module
 * scope to lay its walked routes out in metres, and the cycle left BARN
 * undefined at the moment macro.ts was evaluated — a blank white room and one
 * line in the console. Constants other modules measure against do not belong
 * inside a component file.
 */

export const BARN = {
  halfWidth: 6,
  frontZ: -4,
  backZ: 6,
  eaveY: 4.6,
  ridgeY: 7.2,
  /**
   * The open sliding door on the gable end.
   *
   * Kept to 3.6m. At five metres across it stops being a door you look
   * through and becomes a missing wall: stand anywhere near it and the
   * opening subtends more than the entire field of view, so the barn
   * disappears and you are left looking at an unframed photograph.
   */
  door: { x0: -1.8, x1: 1.8, y1: 3.4 },
  /** A small opening on the south wall, for cross light. */
  sideWindow: { z0: 0.4, z1: 2.2, y0: 1.9, y1: 3.1 },
  /**
   * The way through to the bakery, cut in the back wall.
   *
   * Off-centre on purpose. Centred, it lines up with the open door at the
   * other end and you can see straight out of the building from inside the
   * bakery — which makes the barn read as a tunnel rather than a room with
   * another room off it.
   */
  hatch: { x0: 1.5, x1: 3.3, y1: 2.35 },
} as const
