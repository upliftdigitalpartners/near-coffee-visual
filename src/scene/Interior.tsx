import { useMemo } from 'react'
import { mixColor, type Daylight } from './daylight'
import { EXTENT_BOTTOM, EXTENT_TOP, svgStyle } from './viewport'

/**
 * The room.
 *
 * Modelled on the Tip Top House on the summit of Mount Washington: rough-cut
 * granite blasted from the mountain itself, laid up in courses with the mortar
 * set deep so the joints read as shadow rather than line. One and a half
 * storeys, so the ceiling is low and the beams are close over your head. The
 * openings are plain rectangles cut through a wall thick enough to survive a
 * winter up there.
 *
 * That thickness is the whole trick of this scene. A deep reveal means the
 * window is not a picture on a wall, it is a tunnel — and when you shift in
 * your seat the stone jamb scrapes across the Grand and the room becomes a
 * place instead of an image.
 *
 * On framing: the design band is 1000x700 drawn with `slice`, so on a wide
 * screen roughly y 70..630 survives the crop, and everything that matters
 * lives inside that. On portrait the viewBox grows (see viewport.ts), which is
 * why the ceiling and floor are drawn well past the band.
 */

/** Room-side face of the opening. */
const APERTURE = { x: 268, y: 150, w: 464, h: 288 }
/** Outside face, set back into the wall — the reveal spans between the two. */
const OUTER = { x: 300, y: 172, w: 400, h: 244 }

const WALL_TOP = 80
const WALL_BOTTOM = 560

type Block = { x: number; y: number; w: number; h: number; tone: number }

/** Rough-cut courses. Same wall every visit; it is a building, not a mood ring. */
function buildCourses(): Block[] {
  let seed = 18530607 // the year they hauled the first stone up
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const blocks: Block[] = []
  let y = WALL_TOP
  while (y < WALL_BOTTOM) {
    const h = 26 + rand() * 20
    let x = -50 + rand() * 34
    while (x < 1050) {
      // Wide spread of block sizes — rough-cut, not coursed ashlar.
      const w = 40 + rand() * rand() * 150
      blocks.push({
        x,
        y: y + (rand() - 0.5) * 4,
        w,
        h: Math.min(h + (rand() - 0.5) * 6, WALL_BOTTOM - y),
        tone: rand(),
      })
      x += w + 4 + rand() * 5
    }
    y += h + 4
  }
  return blocks
}

/** Granite, warmed by whatever light is currently in the room. */
function stoneColor(tone: number, ambient: string): string {
  const greys = ['#3a3733', '#2e2b28', '#443f39', '#26241f', '#35302a', '#2b2824', '#3f3931']
  const base = greys[Math.floor(tone * greys.length) % greys.length]
  return mixColor(base, ambient, 0.3)
}

export function RoomShell({ light, viewBox }: { light: Daylight; viewBox: string }) {
  const blocks = useMemo(buildCourses, [])
  const mortar = mixColor('#15110e', light.interiorAmbient, 0.22)

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        {/* Everything except the hole in the wall. */}
        <mask id="wallMask">
          <rect
            x="-120"
            y={EXTENT_TOP}
            width="1240"
            height={EXTENT_BOTTOM - EXTENT_TOP}
            fill="#fff"
          />
          <rect x={OUTER.x} y={OUTER.y} width={OUTER.w} height={OUTER.h} fill="#000" />
        </mask>

        <linearGradient
          id="ceiling"
          x1="0"
          y1={EXTENT_TOP}
          x2="0"
          y2={WALL_TOP + 4}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={mixColor('#040303', light.interiorAmbient, 0.08)} />
          <stop offset="72%" stopColor={mixColor('#070505', light.interiorAmbient, 0.14)} />
          <stop offset="100%" stopColor={mixColor('#140e09', light.interiorAmbient, 0.3)} />
        </linearGradient>

        <linearGradient
          id="floor"
          x1="0"
          y1={WALL_BOTTOM}
          x2="0"
          y2="820"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={mixColor('#241a12', light.interiorAmbient, 0.4)} />
          <stop offset="100%" stopColor={mixColor('#0d0806', light.interiorAmbient, 0.16)} />
        </linearGradient>

        {/* Light spilling out of the opening onto the surrounding stone. */}
        <radialGradient id="bloom" cx="500" cy="294" r="300" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe9c4" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffe9c4" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="lampGlow" cx="200" cy="420" r="230" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffb54a" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ffb54a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ceiling, with the beams low over your head. */}
      <rect
        x="-120"
        y={EXTENT_TOP}
        width="1240"
        height={WALL_TOP + 4 - EXTENT_TOP}
        fill="url(#ceiling)"
      />
      {/*
       * Beams get a lit top edge. Without it they are the same value as the
       * ceiling behind them and the whole upper frame reads as void — which
       * matters most on portrait, where a lot more ceiling is in shot.
       */}
      {[
        { y: -196, h: 13 },
        { y: -140, h: 14 },
        { y: -88, h: 15 },
        { y: -36, h: 17 },
        { y: 8, h: 19 },
        { y: 40, h: 22 },
        { y: 72, h: 26 },
      ].map((b, i) => (
        <g key={i}>
          <rect
            x="-120"
            y={b.y}
            width="1240"
            height={b.h}
            rx="3"
            fill={mixColor('#0f0a07', light.interiorAmbient, 0.22)}
          />
          <rect
            x="-120"
            y={b.y}
            width="1240"
            height="2.5"
            fill={mixColor('#5a4530', light.interiorAmbient, 0.4)}
            opacity="0.5"
          />
        </g>
      ))}

      {/* Floor. */}
      <rect
        x="-120"
        y={WALL_BOTTOM}
        width="1240"
        height={EXTENT_BOTTOM - WALL_BOTTOM}
        fill="url(#floor)"
      />
      <g stroke={mixColor('#060403', light.interiorAmbient, 0.1)} strokeWidth="2" opacity="0.75">
        {[120, 260, 400, 540, 680, 820].map((x, i) => (
          <line key={i} x1={x} y1={WALL_BOTTOM} x2={x + (x - 500) * 1.6} y2={EXTENT_BOTTOM} />
        ))}
        <line x1="-120" y1="606" x2="1120" y2="606" strokeWidth="1.4" />
        <line x1="-120" y1="664" x2="1120" y2="664" strokeWidth="1.4" />
        <line x1="-120" y1="742" x2="1120" y2="742" strokeWidth="1.4" />
      </g>

      {/* The wall, with the opening cut clean through it. */}
      <g mask="url(#wallMask)">
        <rect
          x="-120"
          y={WALL_TOP - 6}
          width="1240"
          height={WALL_BOTTOM - WALL_TOP + 12}
          fill={mixColor('#161210', light.interiorAmbient, 0.2)}
        />
        {blocks.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="3"
            fill={stoneColor(b.tone, light.interiorAmbient)}
          />
        ))}
        {/* Mortar reads as shadow between the courses, never as a drawn line. */}
        {blocks.map((b, i) => (
          <rect
            key={`m${i}`}
            x={b.x}
            y={b.y + b.h - 4}
            width={b.w}
            height="4"
            fill={mortar}
            opacity="0.8"
          />
        ))}
      </g>

      {/* The reveal: four splayed faces between the room and the outside. */}
      <g>
        {/* Soffit — always the darkest, nothing bounces up into it. */}
        <path
          d={`M${APERTURE.x},${APERTURE.y} L${OUTER.x},${OUTER.y} L${OUTER.x + OUTER.w},${OUTER.y} L${APERTURE.x + APERTURE.w},${APERTURE.y} Z`}
          fill={mixColor('#100d0b', light.interiorAmbient, 0.2)}
        />
        {/* Jambs. */}
        <path
          d={`M${APERTURE.x},${APERTURE.y} L${OUTER.x},${OUTER.y} L${OUTER.x},${OUTER.y + OUTER.h} L${APERTURE.x},${APERTURE.y + APERTURE.h} Z`}
          fill={mixColor('#4f4840', light.interiorAmbient, 0.44)}
        />
        <path
          d={`M${APERTURE.x + APERTURE.w},${APERTURE.y} L${OUTER.x + OUTER.w},${OUTER.y} L${OUTER.x + OUTER.w},${OUTER.y + OUTER.h} L${APERTURE.x + APERTURE.w},${APERTURE.y + APERTURE.h} Z`}
          fill={mixColor('#332e29', light.interiorAmbient, 0.34)}
        />
        {/* Sill — catches the most light, and where you put your elbows. */}
        <path
          d={`M${APERTURE.x},${APERTURE.y + APERTURE.h} L${OUTER.x},${OUTER.y + OUTER.h} L${OUTER.x + OUTER.w},${OUTER.y + OUTER.h} L${APERTURE.x + APERTURE.w},${APERTURE.y + APERTURE.h} Z`}
          fill={mixColor('#7c7365', light.interiorAmbient, 0.32)}
        />
      </g>

      {/* Sash and muntins, sitting in the outer face. */}
      <g stroke={mixColor('#221709', light.interiorAmbient, 0.28)} fill="none">
        <rect x={OUTER.x} y={OUTER.y} width={OUTER.w} height={OUTER.h} strokeWidth="9" />
        <line x1={OUTER.x + OUTER.w / 3} y1={OUTER.y} x2={OUTER.x + OUTER.w / 3} y2={OUTER.y + OUTER.h} strokeWidth="5" />
        <line x1={OUTER.x + (2 * OUTER.w) / 3} y1={OUTER.y} x2={OUTER.x + (2 * OUTER.w) / 3} y2={OUTER.y + OUTER.h} strokeWidth="5" />
        <line x1={OUTER.x} y1={OUTER.y + OUTER.h / 2} x2={OUTER.x + OUTER.w} y2={OUTER.y + OUTER.h / 2} strokeWidth="5" />
      </g>

      <rect
        x="-120"
        y={EXTENT_TOP}
        width="1240"
        height={EXTENT_BOTTOM - EXTENT_TOP}
        fill="url(#bloom)"
        opacity={light.windowBloom}
        style={{ mixBlendMode: 'screen' }}
      />
      <rect
        x="-120"
        y={EXTENT_TOP}
        width="1240"
        height={EXTENT_BOTTOM - EXTENT_TOP}
        fill="url(#lampGlow)"
        opacity={light.lampIntensity}
        style={{ mixBlendMode: 'screen' }}
      />
    </svg>
  )
}

/**
 * Low evening sun is the only time light actually gets in here — the window
 * faces west, so mornings are all bounce and no beam.
 */
export function LightShaft({ light, viewBox }: { light: Daylight; viewBox: string }) {
  if (light.shaftIntensity < 0.02) return null
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      style={{ ...svgStyle, mixBlendMode: 'screen', pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient
          id="shaftGrad"
          x1="0"
          y1="178"
          x2="260"
          y2="760"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={light.shaftColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={light.shaftColor} stopOpacity="0" />
        </linearGradient>
        <filter id="shaftBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {/*
       * Three beams thrown by the muntins rather than one wide wash — a shaft
       * without edges just reads as the room being turned up.
       */}
      <g opacity={light.shaftIntensity * 0.85} filter="url(#shaftBlur)">
        <path d="M306,178 L428,178 L520,780 L188,780 Z" fill="url(#shaftGrad)" />
        <path d="M440,178 L562,178 L720,780 L392,780 Z" fill="url(#shaftGrad)" />
        <path d="M574,178 L694,178 L920,780 L596,780 Z" fill="url(#shaftGrad)" />
      </g>
    </svg>
  )
}

/**
 * Dust turning in the window light. Only visible when there is light to catch
 * it, which is why the opacity rides windowBloom rather than being constant —
 * motes drifting through a dark room at midnight would be snow.
 */
export function DustMotes({ light, viewBox }: { light: Daylight; viewBox: string }) {
  const motes = useMemo(() => {
    let seed = 77712
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    return Array.from({ length: 30 }, () => ({
      x: 250 + rand() * 520,
      y: 190 + rand() * 400,
      r: 0.9 + rand() * 1.8,
      drift: 14 + rand() * 26,
      dur: 11 + rand() * 16,
      delay: rand() * 12,
    }))
  }, [])

  if (light.windowBloom < 0.15) return null

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      style={{ ...svgStyle, pointerEvents: 'none', mixBlendMode: 'screen' }}
    >
      <g fill="#ffeccd" opacity={light.windowBloom * 0.55}>
        {motes.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.r}>
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,0; ${m.drift * 0.4},${-m.drift}; ${-m.drift * 0.3},${-m.drift * 2}`}
              dur={`${m.dur}s`}
              begin={`${m.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.9;0"
              dur={`${m.dur}s`}
              begin={`${m.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
    </svg>
  )
}

/** Counter, shelf, oil lamp — the far side of the room. */
export function RoomFurniture({ light, viewBox }: { light: Daylight; viewBox: string }) {
  const timber = mixColor('#33210f', light.interiorAmbient, 0.36)
  const timberDark = mixColor('#170f07', light.interiorAmbient, 0.24)

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      {/* Shelf with the day's beans and a row of cups. */}
      <rect x="18" y="300" width="228" height="9" rx="2" fill={timber} />
      <g fill={timberDark}>
        <rect x="40" y="266" width="26" height="34" rx="3" />
        <rect x="76" y="272" width="22" height="28" rx="3" />
        <rect x="110" y="262" width="30" height="38" rx="4" />
      </g>
      <g fill={mixColor('#9d907c', light.interiorAmbient, 0.34)}>
        <rect x="160" y="280" width="17" height="20" rx="3" />
        <rect x="185" y="280" width="17" height="20" rx="3" />
        <rect x="210" y="280" width="17" height="20" rx="3" />
      </g>

      {/* Counter. */}
      <rect x="-120" y="436" width="396" height="18" rx="4" fill={mixColor('#5d4b36', light.interiorAmbient, 0.38)} />
      <rect x="-120" y="454" width="396" height={EXTENT_BOTTOM - 454} fill={timber} />
      <g stroke={timberDark} strokeWidth="2" opacity="0.65">
        <line x1="58" y1="454" x2="58" y2="900" />
        <line x1="144" y1="454" x2="144" y2="900" />
        <line x1="230" y1="454" x2="230" y2="900" />
      </g>

      {/* Oil lamp. It is doing most of the work in this room after dark. */}
      <g>
        <ellipse cx="200" cy="434" rx="19" ry="5" fill={timberDark} />
        <path d="M190,434 L190,417 Q200,409 210,417 L210,434 Z" fill="#c9903f" opacity="0.5" />
        <path d="M193,417 Q200,388 207,417 Z" fill="#ffd27a">
          <animate
            attributeName="opacity"
            values="0.85;1;0.9;1;0.86"
            dur="4.3s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="200" cy="406" r="26" fill="#ffb347" opacity={0.2 * light.lampIntensity + 0.06}>
          <animate attributeName="r" values="24;29;25;27;24" dur="5.1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  )
}

/**
 * Your table. Cropped hard at the bottom of the frame so you are sitting at
 * it rather than looking at it.
 */
export function TableForeground({ light, viewBox }: { light: Daylight; viewBox: string }) {
  const timber = mixColor('#241609', light.interiorAmbient, 0.3)
  const timberEdge = mixColor('#3d2513', light.interiorAmbient, 0.4)
  const ceramic = mixColor('#cfc2ac', light.interiorAmbient, 0.28)

  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        <linearGradient
          id="tableGrad"
          x1="0"
          y1="572"
          x2="0"
          y2="900"
          gradientUnits="userSpaceOnUse"
        >
          {/*
           * Falls off hard. On portrait a lot of table is in frame, and a
           * slow gradient leaves the bottom third looking like an empty brown
           * field rather than a surface receding into an unlit room.
           */}
          <stop offset="0%" stopColor={timberEdge} />
          <stop offset="9%" stopColor={timber} />
          <stop offset="48%" stopColor={mixColor('#0c0704', light.interiorAmbient, 0.14)} />
          <stop offset="100%" stopColor="#070403" />
        </linearGradient>
      </defs>

      {/* Steam, drawn under the cup rim so it reads as rising out of it. */}
      <g fill="none" stroke="#fff4e2" strokeWidth="3" strokeLinecap="round" opacity="0.2">
        <path d="M712,524 Q704,502 714,482 Q722,464 716,446">
          <animate attributeName="opacity" values="0;0.3;0" dur="7s" repeatCount="indefinite" />
        </path>
        <path d="M732,526 Q742,504 734,484 Q726,466 734,448">
          <animate attributeName="opacity" values="0;0.24;0" dur="9s" begin="2s" repeatCount="indefinite" />
        </path>
      </g>

      {/* Saucer and cup. */}
      <g>
        <ellipse cx="724" cy="580" rx="54" ry="15" fill="#000" opacity="0.35" />
        <ellipse cx="724" cy="574" rx="47" ry="13" fill={ceramic} />
        <path d="M693,568 Q695,530 724,530 Q753,530 755,568 Z" fill={ceramic} />
        <ellipse cx="724" cy="532" rx="28" ry="7" fill={mixColor('#38200f', light.interiorAmbient, 0.24)} />
        <path
          d="M755,543 Q776,541 776,553 Q776,564 757,562"
          fill="none"
          stroke={ceramic}
          strokeWidth="6"
        />
      </g>

      {/* Notebook, closed, with a pencil. Someone was writing here. */}
      <g transform="rotate(-7 400 620)">
        <rect x="318" y="566" width="162" height="120" rx="4" fill={mixColor('#3f3020', light.interiorAmbient, 0.3)} />
        <rect x="326" y="572" width="146" height="108" rx="3" fill={mixColor('#756750', light.interiorAmbient, 0.28)} />
        <rect x="350" y="556" width="124" height="7" rx="3" fill={mixColor('#5d4626', light.interiorAmbient, 0.36)} />
      </g>

      {/* The table edge itself. */}
      <path
        d={`M-120,600 Q500,572 1120,600 L1120,${EXTENT_BOTTOM} L-120,${EXTENT_BOTTOM} Z`}
        fill="url(#tableGrad)"
      />
      <path
        d="M-120,600 Q500,572 1120,600"
        fill="none"
        stroke={timberEdge}
        strokeWidth="4"
        opacity="0.85"
      />
    </svg>
  )
}
