import { useEffect, useState } from 'react'
import { daylightAt, localHour, mixColor, type Daylight } from './scene/daylight'
import { ParallaxProvider, Layer } from './scene/parallax'
import { useSceneViewBox, svgStyle } from './scene/viewport'
import { View } from './scene/View'
import {
  RoomShell,
  RoomFurniture,
  TableForeground,
  LightShaft,
  DustMotes,
} from './scene/Interior'

/**
 * Layer depths. 0 is the Grand at infinity, 1 is the edge of your own table.
 * The pivot lives at 0.35 (see parallax.tsx), which is roughly the glass.
 */
const DEPTH = {
  view: 0.02,
  glass: 0.3,
  shell: 0.42,
  shaft: 0.5,
  motes: 0.56,
  furniture: 0.6,
  table: 1,
} as const

function Glass({ light, viewBox }: { light: Daylight; viewBox: string }) {
  return (
    <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={svgStyle}>
      <defs>
        <linearGradient
          id="glassSheen"
          x1="300"
          y1="172"
          x2="640"
          y2="416"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#dfeaff" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#dfeaff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#dfeaff" stopOpacity="0.09" />
        </linearGradient>
      </defs>
      <rect x="300" y="172" width="400" height="244" fill="url(#glassSheen)" />
      {/* Old glass is never flat. A couple of slow streaks and some grime. */}
      <g stroke="#ffffff" strokeWidth="2" opacity="0.05" fill="none">
        <path d="M306,180 L470,414" />
        <path d="M368,174 L534,414" />
      </g>
      <rect
        x="300"
        y="172"
        width="400"
        height="244"
        fill={mixColor('#8899aa', light.skyHorizon, 0.5)}
        opacity="0.06"
      />
    </svg>
  )
}

function formatHour(h: number): string {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h - Math.floor(h)) * 60)
  const suffix = hh < 12 ? 'am' : 'pm'
  const display = hh % 12 === 0 ? 12 : hh % 12
  return `${display}:${String(mm).padStart(2, '0')}${suffix}`
}

export default function App() {
  const [hour, setHour] = useState(() => localHour())
  const [scrubbing, setScrubbing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const viewBox = useSceneViewBox()

  // Follow the visitor's real clock unless they have taken the wheel.
  useEffect(() => {
    if (scrubbing) return
    const id = setInterval(() => setHour(localHour()), 20_000)
    return () => clearInterval(id)
  }, [scrubbing])

  const light = daylightAt(hour)

  return (
    <ParallaxProvider>
      <main className="shop" style={{ background: light.skyHorizon }}>
        <div className="stage">
          <Layer depth={DEPTH.view}>
            <View light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.glass}>
            <Glass light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.shell}>
            <RoomShell light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.shaft}>
            <LightShaft light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.motes}>
            <DustMotes light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.furniture}>
            <RoomFurniture light={light} viewBox={viewBox} />
          </Layer>
          <Layer depth={DEPTH.table}>
            <TableForeground light={light} viewBox={viewBox} />
          </Layer>

          <div className="grain" aria-hidden />
          <div className="vignette" aria-hidden />
        </div>

        {/*
         * Deliberately a small mark rather than a hero title. The room should
         * be the first thing you notice; the name can wait a second.
         */}
        <header className="sign">
          <h1>near coffee</h1>
          <p>below the Tetons · open whenever you are</p>
        </header>

        <div className={`clock ${panelOpen ? 'open' : ''}`}>
          <button
            className="clock-face"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
          >
            {formatHour(hour)} · {light.label}
          </button>
          {panelOpen && (
            <div className="clock-panel">
              <input
                type="range"
                min={0}
                max={23.99}
                step={0.05}
                value={hour}
                onChange={(e) => {
                  setScrubbing(true)
                  setHour(Number(e.target.value))
                }}
                aria-label="Time of day"
              />
              <button
                className="clock-reset"
                onClick={() => {
                  setScrubbing(false)
                  setHour(localHour())
                }}
              >
                back to now
              </button>
            </div>
          )}
        </div>
      </main>
    </ParallaxProvider>
  )
}
