/**
 * The napkin wall.
 *
 * One line each, pinned by the door, gone after seven days. The impermanence
 * is the point — it is a wall for people passing through, not a guestbook, and
 * a note that lasts forever stops being worth writing.
 *
 * Storage sits behind an interface with two implementations. LocalStore keeps
 * notes in this browser only: real behaviour, no sharing, no account, and it
 * is what runs until a backend exists. RemoteStore talks to a JSON endpoint
 * and is the one that makes the wall actually shared.
 *
 * Everything above the store — the fading, the limits, the 3D — is identical
 * either way, so swapping in the backend changes one line and nothing else.
 */

export const MAX_LENGTH = 90
export const LIFETIME_DAYS = 7
const LIFETIME_MS = LIFETIME_DAYS * 24 * 60 * 60 * 1000

/** Most people write one note. This is a speed bump, not a security control. */
const MIN_INTERVAL_MS = 60 * 1000
const LOCAL_KEY = 'nc.napkins'
const LAST_WRITE_KEY = 'nc.napkins.lastWrite'

export type Napkin = {
  id: string
  text: string
  /** Epoch ms. */
  at: number
}

export interface NapkinStore {
  list(): Promise<Napkin[]>
  add(text: string): Promise<Napkin>
  /** Whether this store is shared with other visitors. */
  readonly shared: boolean
}

/** 0 when freshly pinned, 1 the moment it should be gone. */
export function ageOf(n: Napkin, now = Date.now()): number {
  return Math.min(1, Math.max(0, (now - n.at) / LIFETIME_MS))
}

export function isAlive(n: Napkin, now = Date.now()): boolean {
  return now - n.at < LIFETIME_MS
}

/**
 * Strip control characters, collapse whitespace, cap the length.
 *
 * This is NOT moderation. It stops accidents and lazy nuisance, not anyone who
 * means it. Real moderation has to live server-side next to a delete key —
 * read the README before this wall is ever shared.
 */
export function clean(input: string): string {
  const printable = Array.from(input)
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('')
  return printable.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH)
}

export function throttled(now = Date.now()): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_WRITE_KEY) ?? 0)
    return now - last < MIN_INTERVAL_MS
  } catch {
    return false
  }
}

function markWrite(now = Date.now()) {
  try {
    localStorage.setItem(LAST_WRITE_KEY, String(now))
  } catch {
    /* private browsing */
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export class LocalStore implements NapkinStore {
  readonly shared = false

  async list(): Promise<Napkin[]> {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      const all: Napkin[] = raw ? JSON.parse(raw) : []
      const alive = all.filter((n) => isAlive(n))
      // Expiry is enforced on read, so the seven days are real even offline.
      if (alive.length !== all.length) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(alive))
      }
      return alive
    } catch {
      return []
    }
  }

  async add(text: string): Promise<Napkin> {
    const napkin: Napkin = { id: newId(), text: clean(text), at: Date.now() }
    const all = await this.list()
    all.push(napkin)
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all))
    } catch {
      /* nothing sensible to do */
    }
    markWrite()
    return napkin
  }
}

/**
 * Talks to a JSON endpoint. Deliberately dumb about what is behind it, so
 * Supabase, a Vercel function, or anything else answering these two shapes
 * will do:
 *
 *   GET  {base}         -> Napkin[]
 *   POST {base} {text}  -> Napkin
 */
export class RemoteStore implements NapkinStore {
  readonly shared = true
  constructor(
    private base: string,
    private headers: Record<string, string> = {},
  ) {}

  async list(): Promise<Napkin[]> {
    const res = await fetch(this.base, { headers: this.headers })
    if (!res.ok) throw new Error(`wall unavailable (${res.status})`)
    const rows: Napkin[] = await res.json()
    return rows.filter((n) => isAlive(n))
  }

  async add(text: string): Promise<Napkin> {
    const res = await fetch(this.base, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Supabase returns nothing on insert without this; harmless elsewhere.
        prefer: 'return=representation',
        ...this.headers,
      },
      body: JSON.stringify({ text: clean(text) }),
    })
    if (!res.ok) throw new Error(`could not pin that (${res.status})`)
    markWrite()
    const body = await res.json()
    // PostgREST answers with an array of the inserted rows.
    return Array.isArray(body) ? body[0] : body
  }
}

/**
 * Reads VITE_WALL_ENDPOINT at build time. Unset — which is the case today —
 * and the wall runs local-only rather than pretending to be shared.
 */
export function createStore(): NapkinStore {
  const base = import.meta.env.VITE_WALL_ENDPOINT
  if (base) {
    const key = import.meta.env.VITE_WALL_KEY
    return new RemoteStore(base, key ? { apikey: key, authorization: `Bearer ${key}` } : {})
  }
  return new LocalStore()
}

/**
 * A napkin, drawn. Paper rather than a text label: the wall should look like
 * scraps of card someone actually pinned up, and a floating DOM overlay per
 * note would neither sit in the light nor survive the camera moving.
 */
export function napkinTexture(text: string, seed: number): HTMLCanvasElement {
  const W = 512
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

  ctx.fillStyle = `hsl(${38 + rand() * 12}, ${14 + rand() * 12}%, ${86 + rand() * 8}%)`
  ctx.fillRect(0, 0, W, H)

  // Fibre and a faint fold, so it is paper and not a white rectangle.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(120,104,86,${rand() * 0.06})`
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1 + rand() * 2)
  }
  ctx.strokeStyle = 'rgba(120,104,86,0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, H * (0.42 + rand() * 0.16))
  ctx.lineTo(W, H * (0.42 + rand() * 0.16))
  ctx.stroke()

  ctx.fillStyle = `rgba(${40 + rand() * 25},${34 + rand() * 20},${30 + rand() * 18},0.86)`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Wrap by hand; canvas has no idea about lines.
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  const size = text.length > 52 ? 40 : text.length > 28 ? 50 : 60
  ctx.font = `italic ${size}px "Snell Roundhand", "Segoe Script", "Bradley Hand", cursive, serif`
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (ctx.measureText(trial).width > W - 70 && line) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)

  const lh = size * 1.25
  const top = H / 2 - ((lines.length - 1) * lh) / 2
  lines.slice(0, 4).forEach((l, i) => {
    ctx.save()
    // A degree or so of wobble per line: nobody writes straight on a napkin.
    ctx.translate(W / 2, top + i * lh)
    ctx.rotate((rand() - 0.5) * 0.03)
    ctx.fillText(l, 0, 0)
    ctx.restore()
  })

  return c
}
