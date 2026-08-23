import * as THREE from 'three'

/**
 * The four places you can sit.
 *
 * The handoff names four and gives coordinates, but those are in its own
 * layout — a 9m-wide barn running z -7 to 6 — and this one is 12m wide and
 * runs -4 to 6, with different furniture in different places. So the *seats*
 * are the handoff's and the numbers are this building's: the window bench, a
 * stool by the stove, your own table, and the porch.
 *
 * Each carries the view it faces, because that is the whole point of choosing
 * where to sit. The window bench looks down the length of the room at the
 * door; the stove seat looks back across the tables into the warm corner; your
 * table looks out at the range; the porch looks at nothing but the range.
 *
 * Eye height drops to 1.16 from the standing 1.58. That single number does
 * more than any of the geometry — everything in the room gets taller, the
 * tabletop comes up to meet you, and the doorway stops being something you
 * walk through and becomes something you look through.
 */

export type Seat = {
  /** Where the sitter's head is, in world space. */
  at: THREE.Vector3
  /** What they are looking at. */
  look: THREE.Vector3
  /** Named on the marker and in the panel. */
  label: string
  /**
   * A short passage, shown while seated.
   *
   * Placeholder in the owner's voice, per the handoff's note on copy — plain,
   * specific, a little dry, and meant to be replaced with his own.
   */
  passage: string
  /** Where a cup lands if you order from here. */
  tray: [number, number, number]
}

/** Seated eye height, per the handoff. */
export const SIT = 1.16

export const SEATS: Seat[] = [
  {
    label: 'your table',
    /*
     * Aimed six degrees right of the door, and two degrees down.
     *
     * Both are forced by the overlay rather than by the view. The panel takes
     * the bottom-right corner while you are seated, and aiming straight at the
     * door put your own cup at +16 degrees — directly behind it, so ordering
     * one delivered it somewhere you could not see. Six degrees right slides it
     * clear. The two degrees down drop the nearest ceiling bulb, which
     * otherwise sits at +22.3 against a +22.1 frame edge and is sliced in half.
     */
    at: new THREE.Vector3(0.85, SIT, 4.05),
    look: new THREE.Vector3(1.9, 0.75, -6),
    passage:
      'You were already sitting here when you arrived. The cup is still warm, ' +
      'so it cannot have been long. Out through the door the light is going ' +
      'the way it goes every evening, which is to say slowly and then all at once.',
    /*
     * Not where the cup already is.
     *
     * The obvious tray position is the cup you arrived with, and putting the
     * new one there merges the two into one doubled object with two saucer
     * rims. This spot is clear of that cup, clear of the notebook, on the
     * table, inside the frame, and left of where the seated panel starts —
     * which is four constraints and very little room between them.
     */
    tray: [0.72, 0.79, 2.85],
  },
  {
    label: 'the window bench',
    at: new THREE.Vector3(-5.05, SIT, 2.2),
    look: new THREE.Vector3(-1.2, 1.3, -4),
    passage:
      'The bench came out of the stalls when the barn stopped being a barn. ' +
      'You can still see where the boards were cut. In the afternoon the gap ' +
      'above your head puts a stripe of sun along it, and it moves while you sit.',
    tray: [-4.95, 0.53, 1.7],
  },
  {
    label: 'the chair by the stove',
    /*
     * Further off the stove than "by the stove" suggests. At under two metres
     * the stove fills the frame, and it is still an untextured black cylinder,
     * so the shot is a black cylinder. Back here the corner reads instead —
     * firewood, the bench, the wall — with the stove at the end of it. This is
     * the weakest of the four seats and will stay that way until the stove is
     * a real modelled object rather than a primitive.
     */
    at: new THREE.Vector3(-2.6, SIT, 2.05),
    look: new THREE.Vector3(-4.8, 0.95, 4.1),
    passage:
      'Closest chair to the stove, and the first one taken on a cold morning. ' +
      'The wood is split small because the firebox is small. Nobody who sits ' +
      'here gets up quickly.',
    tray: [-3.25, 0.79, 3.28],
  },
  {
    label: 'the porch bench',
    at: new THREE.Vector3(-2.3, SIT + 0.44, -4.35),
    look: new THREE.Vector3(0.4, 1.1, -22),
    passage:
      'Outside, under the roof, with the whole range in front of you and no ' +
      'glass in the way. It is colder out here. People sit here anyway, in ' +
      'coats, holding the cup with both hands.',
    tray: [-2.3, 0.58, -4.62],
  },
]
