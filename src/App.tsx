import { useEffect, useMemo, useState } from 'react'
import { daylightAt, localHour } from './scene/daylight'
import { Scene } from './three/Scene'

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
  const [walked, setWalked] = useState(false)

  // Follow the visitor's real clock unless they have taken the wheel.
  useEffect(() => {
    if (scrubbing) return
    const id = setInterval(() => setHour(localHour()), 20_000)
    return () => clearInterval(id)
  }, [scrubbing])

  const daylight = useMemo(() => daylightAt(hour), [hour])

  return (
    <main className="shop">
      <Scene
        hour={hour}
        daylight={daylight}
        onProgress={(p) => {
          if (p > 0.04 && !walked) setWalked(true)
        }}
      />

      <header className="sign">
        <h1>near coffee</h1>
        <p>a barn on mormon row · open whenever you are</p>
      </header>

      <div className={`hint ${walked ? 'gone' : ''}`}>scroll to walk to the door</div>

      <div className={`clock ${panelOpen ? 'open' : ''}`}>
        <button className="clock-face" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          {formatHour(hour)} · {daylight.label}
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
  )
}
