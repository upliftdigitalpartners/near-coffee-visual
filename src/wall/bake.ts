/**
 * Today's bake.
 *
 * One line on a chalkboard by the door, changed whenever there is something to
 * change it to. It is the smallest thing in this project and probably the one
 * that matters most: everything else here runs itself, and this is the only
 * part that needs a person. A shop where the board never changes is a shop
 * nobody is standing in.
 *
 * Read-only from the browser, deliberately. The napkin wall is for visitors;
 * this board is Fahim's, and the row-level security reflects that — anon may
 * SELECT and nothing else. It is edited from the Supabase table editor, which
 * takes about fifteen seconds from a phone.
 *
 * When there is no board configured, or the row is empty, the slate simply
 * reads as wiped rather than showing an error. A blank chalkboard in a closed
 * kitchen is a true thing to show.
 */

export type Bake = {
  text: string
  /** Epoch ms of the last change, if the row carries one. */
  updatedAt?: number
}

export async function fetchBake(): Promise<Bake | null> {
  const base = import.meta.env.VITE_BAKE_ENDPOINT
  if (!base) return null
  const key = import.meta.env.VITE_WALL_KEY
  try {
    const res = await fetch(base, {
      headers: key ? { apikey: key, authorization: `Bearer ${key}` } : {},
    })
    if (!res.ok) return null
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : rows
    const text = String(row?.text ?? '').trim()
    if (!text) return null
    return {
      text: text.slice(0, 120),
      updatedAt: row?.updated_at ? Date.parse(row.updated_at) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Slate, chalk, and a wooden frame.
 *
 * Chalk is drawn twice — a soft wide pass under a tighter one — because a
 * single crisp stroke reads as a printed sign, and the whole point of a
 * chalkboard is that a hand wrote it this morning.
 */
export function chalkboardTexture(text: string | null): HTMLCanvasElement {
  const W = 1024
  const H = 640
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  let s = 20260822
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }

  // Slate, unevenly worn.
  ctx.fillStyle = '#20262a'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 90; i++) {
    const g = ctx.createRadialGradient(
      rand() * W, rand() * H, 0,
      rand() * W, rand() * H, 90 + rand() * 260,
    )
    g.addColorStop(0, `rgba(${140 + rand() * 40},${150 + rand() * 40},${155 + rand() * 40},${0.012 + rand() * 0.03})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  // Ghosts of everything wiped off it before.
  for (let i = 0; i < 22; i++) {
    ctx.strokeStyle = `rgba(214,222,226,${0.012 + rand() * 0.02})`
    ctx.lineWidth = 12 + rand() * 30
    ctx.beginPath()
    const y = rand() * H
    ctx.moveTo(-20, y)
    ctx.bezierCurveTo(W * 0.3, y + (rand() - 0.5) * 70, W * 0.7, y + (rand() - 0.5) * 70, W + 20, y)
    ctx.stroke()
  }

  const chalk = (str: string, y: number, alpha: number, font: string) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font
    // Soft under-pass, then the stroke itself.
    ctx.fillStyle = `rgba(236,242,244,${alpha * 0.28})`
    ctx.filter = 'blur(3px)'
    ctx.fillText(str, W / 2, y)
    ctx.filter = 'none'
    ctx.fillStyle = `rgba(240,245,247,${alpha})`
    ctx.fillText(str, W / 2 + (rand() - 0.5) * 1.5, y + (rand() - 0.5) * 1.5)
  }

  chalk('TODAY', 118, 0.62, 'italic 54px "Snell Roundhand", "Segoe Script", cursive, serif')
  ctx.strokeStyle = 'rgba(238,244,246,0.4)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(W * 0.3, 168)
  ctx.lineTo(W * 0.7, 172)
  ctx.stroke()

  if (!text) {
    chalk('— wiped clean —', H / 2 + 40, 0.3,
      'italic 46px "Snell Roundhand", "Segoe Script", cursive, serif')
    return c
  }

  // Wrap to at most three lines, shrinking as needed.
  const size = text.length > 60 ? 54 : text.length > 32 ? 66 : 80
  const font = `italic ${size}px "Snell Roundhand", "Segoe Script", cursive, serif`
  ctx.font = font
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (ctx.measureText(trial).width > W - 150 && line) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)

  const lh = size * 1.32
  const top = H / 2 + 60 - ((Math.min(lines.length, 3) - 1) * lh) / 2
  lines.slice(0, 3).forEach((l, i) => chalk(l, top + i * lh, 0.86, font))

  return c
}
