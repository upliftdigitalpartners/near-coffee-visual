import { useMemo } from 'react'
import type { Daylight } from './daylight'
import { EXTENT_BOTTOM, EXTENT_TOP, svgStyle } from './viewport'

/**
 * What is out there.
 *
 * The Tetons as seen from the Jackson Hole side, looking west, so north is on
 * the right. The range's whole character is that it has no foothills — it
 * comes off the valley floor in one move — so there is deliberately nothing
 * between the flats and the rock but a low timbered bench and some haze.
 *
 * The composition is tuned to the window aperture in Interior.tsx: the range
 * sits between y 225 and y 390 so the opening frames sky, then peaks, then
 * flats. Move the aperture and this has to move with it.
 *
 * Every gradient here is userSpaceOnUse rather than the default bounding-box
 * mapping, because the background rects have to extend past the design band
 * for the portrait crop (see viewport.ts) and bounding-box stops would slide
 * around as those rects grow.
 *
 * Left to right (south to north): Buck, South Teton, Middle Teton, the Grand,
 * Mount Owen, Teewinot, then the notch of Cascade Canyon and the broad flat
 * top of Mount Moran.
 */

const SKYLINE =
  'M-120,398 L40,404 L150,392 L240,383 L270,366 L301,375 L331,346 L359,360 ' +
  'L389,331 L407,341 L433,301 L454,319 L477,276 L496,298 L510,282 L525,225 ' +
  'L532,227 L552,277 L567,259 L579,282 L599,265 L615,294 L636,329 L657,320 ' +
  'L678,282 L688,270 L699,267 L730,269 L742,294 L760,329 L860,338 L960,330 ' +
  `L1120,344 L1120,${EXTENT_BOTTOM} L-120,${EXTENT_BOTTOM} Z`

/**
 * Shadowed gullies on the south side of each summit. Small dark wedges do far
 * more for the sense of mass than big lit facets, which just read as origami.
 */
const GULLIES = [
  'M525,225 L510,282 L521,292 Z',
  'M567,259 L552,277 L563,288 Z',
  'M477,276 L454,319 L471,320 Z',
  'M433,301 L407,341 L425,340 Z',
  'M688,270 L678,282 L691,290 Z',
  'M331,346 L301,375 L318,374 Z',
]

/** Snow that never quite goes, tucked up in the couloirs. */
const COULOIRS = [
  'M526,238 L530,264 L527,292 L523,266 Z',
  'M568,270 L572,289 L569,301 L565,287 Z',
  'M478,288 L482,307 L479,317 L475,303 Z',
  'M434,312 L438,327 L435,335 L431,323 Z',
  'M701,273 L728,275 L727,287 L702,284 Z',
]

type Star = { x: number; y: number; r: number; tw: number }

/** Deterministic star field — same sky every visit, which matters. */
function makeStars(count: number): Star[] {
  let seed = 20260809
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * 1000,
      y: -160 + rand() * 480,
      r: 0.5 + rand() * 1.3,
      tw: 2 + rand() * 5,
    })
  }
  return stars
}

export function View({ light, viewBox }: { light: Daylight; viewBox: string }) {
  const stars = useMemo(() => makeStars(200), [])

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        {/*
         * Stop positions are chosen for the window, not the frame: the
         * aperture only exposes roughly 25%–60% of the design band, so the
         * whole sweep from zenith blue to horizon happens inside it.
         */}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="406" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light.skyTop} />
          <stop offset="52%" stopColor={light.skyMid} />
          <stop offset="100%" stopColor={light.skyHorizon} />
        </linearGradient>

        {/*
         * Vertical light on the rock. Summits catch it first and hold it
         * longest, bases stay in shadow — which is what makes alpenglow work
         * without any special-casing.
         */}
        <linearGradient id="rock" x1="0" y1="215" x2="0" y2="400" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light.peakLight} />
          <stop offset="42%" stopColor={light.peakLight} />
          <stop offset="100%" stopColor={light.peakShadow} />
        </linearGradient>

        <linearGradient id="haze" x1="0" y1="332" x2="0" y2="410" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light.haze} stopOpacity="0" />
          <stop offset="100%" stopColor={light.haze} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="flatsGrad" x1="0" y1="412" x2="0" y2="560" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light.haze} />
          <stop offset="26%" stopColor={light.flats} />
          <stop offset="100%" stopColor={light.flats} />
        </linearGradient>

        {/* Glow where the sun has just gone down behind the range. */}
        <radialGradient id="afterglow" cx="520" cy="330" r="470" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={light.skyHorizon} stopOpacity="0.85" />
          <stop offset="100%" stopColor={light.skyHorizon} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect
        x="-120"
        y={EXTENT_TOP}
        width="1240"
        height={EXTENT_BOTTOM - EXTENT_TOP}
        fill="url(#sky)"
      />

      {light.starOpacity > 0.01 && (
        <g opacity={light.starOpacity}>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e8eefc">
              <animate
                attributeName="opacity"
                values="0.35;1;0.35"
                dur={`${s.tw}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </g>
      )}

      <rect
        x="-120"
        y="-60"
        width="1240"
        height="560"
        fill="url(#afterglow)"
        opacity={light.afterglow}
      />

      {/* A faint further ridge to the north, for depth behind Moran. */}
      <path
        d="M700,300 L780,268 L850,296 L930,272 L1010,304 L1010,420 L700,420 Z"
        fill={light.haze}
        opacity="0.55"
      />

      {/* The range. */}
      <g>
        <path d={SKYLINE} fill="url(#rock)" />
        <g fill={light.peakShadow} opacity="0.62">
          {GULLIES.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill={light.peakLight} opacity="0.5">
          {COULOIRS.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </g>

      {/*
       * Keep this restrained. Turned up, it lightens the foot of the range
       * past the sky behind it and the mountains read as fog, not rock.
       */}
      <rect x="-120" y="332" width="1240" height="78" fill="url(#haze)" opacity="0.5" />

      {/* Low timbered bench, then the flats. */}
      <path
        d={`M-120,392 C160,384 320,398 480,390 C660,382 840,398 1120,388 L1120,${EXTENT_BOTTOM} L-120,${EXTENT_BOTTOM} Z`}
        fill={light.flats}
        opacity="0.78"
      />

      {/* A few conifers on the bench, small enough to read as distance. */}
      <g fill={light.peakShadow} opacity="0.65">
        {[
          [96, 392], [128, 396], [140, 390], [286, 392], [312, 396],
          [452, 390], [470, 394], [640, 388], [668, 392], [684, 386],
          [828, 394], [856, 390], [872, 396],
        ].map(([x, y], i) => (
          <path key={i} d={`M${x},${y} l-4,11 l8,0 Z`} />
        ))}
      </g>

      <path
        d={`M-120,412 C200,406 380,420 560,412 C760,404 880,418 1120,410 L1120,${EXTENT_BOTTOM} L-120,${EXTENT_BOTTOM} Z`}
        fill="url(#flatsGrad)"
      />

      {/* Sagebrush, thinning with distance. */}
      <g fill={light.peakShadow} opacity="0.3">
        {[
          [70, 448], [190, 462], [310, 442], [430, 470], [560, 452],
          [690, 476], [810, 450], [930, 466], [140, 500], [380, 512],
          [620, 506], [860, 518],
        ].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={7 + (i % 3) * 3} ry="3.5" />
        ))}
      </g>
    </svg>
  )
}
