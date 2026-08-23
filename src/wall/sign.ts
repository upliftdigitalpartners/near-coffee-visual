/**
 * The painted board that hangs off the porch beam.
 *
 * Drawn rather than photographed, like everything else in `src/wall/` — a sign
 * is text on a plank, and a canvas is the honest way to make text on a plank
 * that stays crisp at any distance the visitor cares to walk to.
 *
 * The paint is worn in the same way real exterior sign-writing wears: thin on
 * the raised grain, intact in the hollows, and lightest along the bottom edge
 * where rain runs off. That is done by knocking holes in the letters after
 * they are drawn rather than by drawing faded letters, because faded letters
 * read as low contrast and worn letters read as old.
 */

const W = 1024
const H = 410

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function signTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const rand = seeded(31337)

  // The board: a dark blue-green that has gone grey, as exterior paint does.
  ctx.fillStyle = '#2f3a38'
  ctx.fillRect(0, 0, W, H)

  // Grain showing through the paint.
  for (let i = 0; i < 150; i++) {
    const y = rand() * H
    ctx.strokeStyle = `rgba(${18 + rand() * 30},${24 + rand() * 30},${24 + rand() * 28},${0.25 + rand() * 0.4})`
    ctx.lineWidth = 0.6 + rand() * 2.4
    ctx.beginPath()
    ctx.moveTo(-10, y)
    for (let x = 0; x < W + 20; x += 60) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 3.5)
    }
    ctx.stroke()
  }

  // A hand-painted border, inset and not quite parallel.
  ctx.strokeStyle = 'rgba(214,198,166,0.55)'
  ctx.lineWidth = 4
  ctx.strokeRect(26, 24, W - 52, H - 50)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e4d8bd'
  ctx.font = '500 132px Georgia, "Times New Roman", serif'
  ctx.fillText('near coffee', W / 2, 190)

  ctx.fillStyle = 'rgba(214,198,166,0.72)'
  ctx.font = 'italic 46px Georgia, "Times New Roman", serif'
  ctx.fillText('since the barn', W / 2, 268)

  ctx.strokeStyle = 'rgba(214,198,166,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W / 2 - 120, 305)
  ctx.lineTo(W / 2 + 120, 305)
  ctx.stroke()

  /*
   * Wear, taken out of the paint rather than drawn over it. destination-out
   * removes what is already there, so the board's own grain shows through the
   * gaps in the letters instead of a grey smear sitting on top of them.
   */
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 900; i++) {
    const x = rand() * W
    // Biased low: rain sits on the bottom edge and lifts the paint there first.
    const y = Math.pow(rand(), 0.65) * H
    const r = 1 + rand() * 5
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.3})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.7), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  return c
}
