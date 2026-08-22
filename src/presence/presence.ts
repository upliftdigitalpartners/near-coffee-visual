/**
 * Who else is in the room.
 *
 * Anonymous silhouettes at the other tables. You cannot talk to them, see who
 * they are, or find out anything about them — they are just there, and they
 * leave when they leave. That is the whole feature, and it is the closest
 * thing here to what Fahim actually likes about cafes.
 *
 * Two providers, same rules as the napkin wall:
 *
 *   LocalPresence  — BroadcastChannel. Real presence, genuinely other windows,
 *                    but only ever your own browser. Open a second tab and a
 *                    second silhouette appears, because there really is one.
 *   RemotePresence — heartbeats to a JSON endpoint. The one that shows
 *                    strangers.
 *
 * The fallback deliberately does NOT invent people. A room populated with
 * fictional visitors would be a lie told to everyone who sat in it, and the
 * one thing a place like this cannot survive is not being real.
 *
 * Nothing identifying is stored or sent. The id is random, lives in
 * sessionStorage, dies with the tab, and is used only to keep a visitor in the
 * same chair while they are here.
 */

const HEARTBEAT_MS = 10_000
/** Miss three beats and you have left. */
const STALE_MS = 32_000
const ID_KEY = 'nc.presence.id'
const CHANNEL = 'nc.presence'

export type Peer = {
  id: string
  /** Epoch ms of the last heartbeat seen. */
  seen: number
}

export interface PresenceProvider {
  /** Called with everyone currently here, not counting you. */
  subscribe(cb: (peers: Peer[]) => void): void
  stop(): void
  /** Whether this sees beyond the current browser. */
  readonly shared: boolean
}

export function selfId(): string {
  try {
    let id = sessionStorage.getItem(ID_KEY)
    if (!id) {
      id = Math.random().toString(36).slice(2, 11)
      sessionStorage.setItem(ID_KEY, id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2, 11)
  }
}

/** Shared bookkeeping: prune the dead, notify on change. */
class PeerTable {
  private peers = new Map<string, number>()
  constructor(private cb: (peers: Peer[]) => void) {}

  saw(id: string, now = Date.now()) {
    this.peers.set(id, now)
  }

  sweep(now = Date.now()) {
    let changed = false
    for (const [id, seen] of this.peers) {
      if (now - seen > STALE_MS) {
        this.peers.delete(id)
        changed = true
      }
    }
    return changed
  }

  emit() {
    this.cb([...this.peers].map(([id, seen]) => ({ id, seen })))
  }
}

export class LocalPresence implements PresenceProvider {
  readonly shared = false
  private channel: BroadcastChannel | null = null
  private timer: number | null = null

  subscribe(cb: (peers: Peer[]) => void) {
    const me = selfId()
    const table = new PeerTable(cb)

    if (typeof BroadcastChannel === 'undefined') {
      cb([])
      return
    }
    const channel = new BroadcastChannel(CHANNEL)
    this.channel = channel

    channel.onmessage = (e) => {
      const { id, kind } = e.data ?? {}
      if (!id || id === me) return
      if (kind === 'left') {
        table.saw(id, 0)
      } else {
        table.saw(id)
        // Answer a new arrival directly so they see us without waiting.
        if (kind === 'hello') channel.postMessage({ id: me, kind: 'beat' })
      }
      table.sweep()
      table.emit()
    }

    channel.postMessage({ id: me, kind: 'hello' })
    this.timer = window.setInterval(() => {
      channel.postMessage({ id: me, kind: 'beat' })
      if (table.sweep()) table.emit()
    }, HEARTBEAT_MS)

    // Say goodbye rather than making everyone wait for the timeout.
    window.addEventListener('pagehide', () => channel.postMessage({ id: me, kind: 'left' }))
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer)
    this.channel?.postMessage({ id: selfId(), kind: 'left' })
    this.channel?.close()
    this.channel = null
  }
}

/**
 * Heartbeats to a JSON endpoint:
 *
 *   POST {base}  { id }   -> anything; records this visitor as present now
 *   GET  {base}           -> [{ id, seen }]   seen = epoch ms
 */
export class RemotePresence implements PresenceProvider {
  readonly shared = true
  private timer: number | null = null
  private stopped = false

  constructor(
    private base: string,
    private headers: Record<string, string> = {},
  ) {}

  subscribe(cb: (peers: Peer[]) => void) {
    const me = selfId()

    const beat = async () => {
      if (this.stopped) return
      try {
        await fetch(this.base, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            prefer: 'resolution=merge-duplicates',
            ...this.headers,
          },
          body: JSON.stringify({ id: me, seen: Date.now() }),
        })
        const res = await fetch(this.base, { headers: this.headers })
        if (!res.ok) return
        const rows: Peer[] = await res.json()
        const now = Date.now()
        cb(rows.filter((p) => p.id !== me && now - p.seen < STALE_MS))
      } catch {
        /* the room simply looks empty; not worth surfacing */
      }
    }

    void beat()
    this.timer = window.setInterval(beat, HEARTBEAT_MS)
  }

  stop() {
    this.stopped = true
    if (this.timer) window.clearInterval(this.timer)
  }
}

export function createPresence(): PresenceProvider {
  const base = import.meta.env.VITE_PRESENCE_ENDPOINT
  if (base) {
    const key = import.meta.env.VITE_WALL_KEY
    return new RemotePresence(base, key ? { apikey: key, authorization: `Bearer ${key}` } : {})
  }
  return new LocalPresence()
}

/**
 * A seated figure, drawn as a soft dark shape.
 *
 * Deliberately not a model. You should never be able to tell anything about
 * the person in the corner — a silhouette that resolves into a character
 * invites you to read it, and the point is that you cannot. Soft edges do more
 * work here than detail would.
 */
export function silhouetteCanvas(seed: number): HTMLCanvasElement {
  const W = 256
  const H = 320
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  let s = seed >>> 0
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }

  const lean = (rand() - 0.5) * 16
  const shoulders = 62 + rand() * 20
  const headR = 25 + rand() * 5
  const headY = 74 + rand() * 10

  ctx.fillStyle = '#000000'
  ctx.beginPath()
  // Torso: shoulders down to where the table cuts them off.
  ctx.moveTo(W / 2 - shoulders + lean, H)
  ctx.quadraticCurveTo(W / 2 - shoulders * 0.95 + lean, headY + 46, W / 2 - 30 + lean, headY + 26)
  ctx.quadraticCurveTo(W / 2 + lean, headY + 14, W / 2 + 30 + lean, headY + 26)
  ctx.quadraticCurveTo(W / 2 + shoulders * 0.95 + lean, headY + 46, W / 2 + shoulders + lean, H)
  ctx.closePath()
  ctx.fill()

  // Head, and a neck thick enough that it does not float.
  ctx.beginPath()
  ctx.ellipse(W / 2 + lean * 1.3, headY, headR * 0.86, headR, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillRect(W / 2 - 12 + lean * 1.2, headY, 24, 34)

  // Occasionally an arm up on the table, or holding something.
  if (rand() > 0.45) {
    ctx.beginPath()
    const side = rand() > 0.5 ? 1 : -1
    ctx.moveTo(W / 2 + side * 44 + lean, headY + 52)
    ctx.quadraticCurveTo(W / 2 + side * 96 + lean, headY + 96, W / 2 + side * 58 + lean, H)
    ctx.lineTo(W / 2 + side * 20 + lean, H)
    ctx.closePath()
    ctx.fill()
  }

  /*
   * Blur the whole thing. A crisp outline reads as a cardboard cutout; the
   * softness is what makes it a person you have not looked at properly.
   */
  const soft = document.createElement('canvas')
  soft.width = W
  soft.height = H
  const sctx = soft.getContext('2d')!
  sctx.filter = 'blur(5px)'
  sctx.drawImage(c, 0, 0)
  return soft
}
