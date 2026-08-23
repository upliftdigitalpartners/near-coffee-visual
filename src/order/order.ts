/**
 * Ordering, which takes time on purpose.
 *
 * The handoff is emphatic that this is "a timed sequence with synthesized
 * sound, not an instant result", and that is the whole design. A cup that
 * appears the moment you click is a form submission. A cup that takes eight
 * seconds, announcing the grind and the shot and the milk while you wait, is
 * somebody making you a coffee. The waiting *is* the feature, and the timings
 * below are the handoff's, unchanged.
 *
 * Nothing here touches the DOM or the scene. It runs a clock and reports what
 * stage it is at, so the panel can show a line of text, the grinder can shake,
 * and a cup can land on the right table — none of which have to know about
 * each other.
 */

export type Item = {
  id: string
  name: string
  price: number
  kind: 'drink' | 'pastry'
}

/** The board, per the handoff. Prices in dollars. */
export const MENU: Item[] = [
  { id: 'drip', name: 'drip', price: 3, kind: 'drink' },
  { id: 'cortado', name: 'cortado', price: 4, kind: 'drink' },
  { id: 'flat-white', name: 'flat white', price: 4, kind: 'drink' },
  { id: 'pour-over', name: 'pour-over', price: 5, kind: 'drink' },
  { id: 'chocolate', name: 'stovetop hot chocolate', price: 4, kind: 'drink' },
  { id: 'croissant', name: 'butter croissant', price: 4, kind: 'pastry' },
  { id: 'morning-bun', name: 'morning bun', price: 4, kind: 'pastry' },
  { id: 'sourdough', name: 'sourdough and jam', price: 5, kind: 'pastry' },
]

/** A line of status, and what the scene should be doing while it shows. */
export type Step = {
  /** Seconds from the start of the order. */
  at: number
  line: string
  /** The grinder shakes while this step is current. */
  grinding?: boolean
  /** Which noise to make when this step begins. */
  sound?: 'grind' | 'hiss' | 'chime'
  /** Seconds the noise runs for. */
  seconds?: number
}

/*
 * Timings straight from the handoff. They look arbitrary and are not: 1.9s of
 * grinding, 3.4s of extraction, 2.2s of steam is roughly what the real
 * sequence takes, and shortening any of them makes the machine feel like a
 * vending machine.
 */
const DRINK: Step[] = [
  { at: 0, line: 'grinding', grinding: true, sound: 'grind', seconds: 1.9 },
  { at: 2.1, line: 'Tamped. Pulling the shot.', sound: 'hiss', seconds: 3.4 },
  { at: 5.7, line: 'Steaming the milk.', sound: 'hiss', seconds: 2.2 },
  { at: 8.2, line: '', sound: 'chime' },
]

const PASTRY: Step[] = [
  { at: 0, line: 'off the tray' },
  { at: 0.9, line: 'Warming it through.' },
  { at: 2.4, line: '', sound: 'chime' },
]

export function stepsFor(item: Item): Step[] {
  return item.kind === 'drink' ? DRINK : PASTRY
}

/** When the thing actually arrives. */
export function readyAt(item: Item): number {
  const steps = stepsFor(item)
  return steps[steps.length - 1].at
}

export type OrderState = {
  item: Item
  /** Where it will land: the table you are sitting at, or the counter. */
  where: 'table' | 'counter'
  /** Seconds since the order started. */
  elapsed: number
  done: boolean
}

/**
 * The line to show right now.
 *
 * The last step's line is empty, so once the order lands this returns the
 * arrival message instead — which is the one place the copy depends on where
 * you were standing when you asked.
 */
export function statusLine(order: OrderState): string {
  if (order.done) {
    return order.where === 'table'
      ? `${order.item.name}, on your table`
      : `${order.item.name}, waiting on the counter`
  }
  const steps = stepsFor(order.item)
  let line = ''
  for (const s of steps) {
    if (order.elapsed >= s.at && s.line) line = s.line
  }
  return line
}

/** True while the grinder should be shaking. */
export function isGrinding(order: OrderState | null): boolean {
  if (!order || order.done) return false
  const steps = stepsFor(order.item)
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const next = steps[i + 1]
    if (!s.grinding) continue
    if (order.elapsed >= s.at && (!next || order.elapsed < next.at)) return true
  }
  return false
}

/**
 * Steps that have just become due, so their sound fires once.
 *
 * Compares against the previous elapsed time rather than tracking an index,
 * because a dropped frame can skip a step entirely — and an order that silently
 * loses its grinder noise is far harder to notice than one that plays twice.
 */
export function crossed(steps: Step[], from: number, to: number): Step[] {
  return steps.filter((s) => s.at > from && s.at <= to)
}
