import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { daylightAt, localHour } from './scene/daylight'
import { fetchPlace, type Place } from './scene/place'
import { Scene } from './three/Scene'
import { Ambience } from './audio/ambience'
import { Radio, type RadioState } from './audio/radio'
import {
  createStore,
  throttled,
  clean,
  MAX_LENGTH,
  LIFETIME_DAYS,
  type Napkin,
} from './wall/napkins'
import { createPresence, type Peer } from './presence/presence'
import { fetchBake, type Bake } from './wall/bake'
import { SEATS } from './scene/seats'
import * as THREE from 'three'
import { Arrival } from './ui/Arrival'
import {
  MENU,
  crossed,
  isGrinding,
  readyAt,
  statusLine,
  stepsFor,
  type Item,
  type OrderState,
} from './order/order'
import { Kitchen } from './audio/kitchen'

/**
 * Where a cup lands when you order standing up.
 *
 * On the counter slab, at the near end by the machine — the end you would
 * actually be standing at, rather than the middle of a four metre counter.
 */
const COUNTER_TRAY: [number, number, number] = [4.05, 1.11, 0.55]
import { forcedHour, forcedSeat, standInNapkins, skipArrival } from './scene/debug'

function formatHour(h: number): string {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h - Math.floor(h)) * 60)
  const suffix = hh < 12 ? 'am' : 'pm'
  const display = hh % 12 === 0 ? 12 : hh % 12
  return `${display}:${String(mm).padStart(2, '0')}${suffix}`
}

export default function App() {
  const [hour, setHour] = useState(() => forcedHour() ?? localHour())
  const [scrubbing, setScrubbing] = useState(() => forcedHour() != null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [walked, setWalked] = useState(false)
  const [place, setPlace] = useState<Place>({ solar: null, weather: null })

  const ambience = useRef<Ambience | null>(null)
  const radio = useRef<Radio | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  /*
   * Whether the barn has painted a frame. Driven by Scene's own sentinel
   * rather than by the loading manager — see Ready in Scene.tsx — with a
   * backstop so a texture that never arrives cannot leave anyone staring at
   * the arrival screen forever. Eighteen seconds is far longer than a cold
   * load on a slow connection and far shorter than giving up on the page.
   */
  const [ready, setReady] = useState(skipArrival)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 18000)
    return () => clearTimeout(t)
  }, [])

  const [radioState, setRadioState] = useState<RadioState>({ playing: false, loading: false })

  const wall = useRef(createStore())
  const [napkins, setNapkins] = useState<Napkin[]>(() => standInNapkins() ?? [])
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState('')
  const [wallNote, setWallNote] = useState('')

  const presence = useRef(createPresence())
  const [peers, setPeers] = useState<Peer[]>([])

  const [bake, setBake] = useState<Bake | null>(null)
  const [station, setStation] = useState('your table')

  const [seatIndex, setSeatIndex] = useState<number | null>(() => forcedSeat())
  const [menuOpen, setMenuOpen] = useState(false)
  const [order, setOrder] = useState<OrderState | null>(null)
  const kitchen = useRef<Kitchen | null>(null)

  // Follow the visitor's real clock unless they have taken the wheel.
  useEffect(() => {
    if (scrubbing) return
    const id = setInterval(() => setHour(localHour()), 20_000)
    return () => clearInterval(id)
  }, [scrubbing])

  /*
   * Conditions at the barn. Fetched once on load and then every quarter hour;
   * both calls are cached and both fail soft, so a dead API just means the
   * scene keeps using its built-in summer day.
   */
  useEffect(() => {
    let alive = true
    const load = () => {
      fetchPlace().then((p) => {
        if (alive) setPlace(p)
      })
    }
    load()
    const id = setInterval(load, 15 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  // Today's bake. Read-only here — the board is Fahim's, not the visitors'.
  useEffect(() => {
    let alive = true
    const load = () => fetchBake().then((b) => { if (alive) setBake(b) })
    load()
    const id = setInterval(load, 15 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  // Who else is here. Nothing identifying is sent; see presence.ts.
  useEffect(() => {
    const p = presence.current
    p.subscribe(setPeers)
    return () => p.stop()
  }, [])

  // The wall, on load. Re-read on a slow timer so notes age out on their own.
  useEffect(() => {
    let alive = true
    if (standInNapkins()) return
    const load = () =>
      wall.current
        .list()
        .then((n) => {
          if (alive) setNapkins(n)
        })
        .catch(() => setWallNote('the wall is not answering'))
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const pin = useCallback(async () => {
    const text = clean(draft)
    if (!text) return
    if (throttled()) {
      setWallNote('one note at a time — give it a minute')
      return
    }
    try {
      await wall.current.add(text)
      setNapkins(await wall.current.list())
      setDraft('')
      setWriting(false)
      setWallNote('')
    } catch (e) {
      setWallNote(e instanceof Error ? e.message : 'could not pin that')
    }
  }, [draft])

  /*
   * The order clock.
   *
   * Driven by a real timestamp rather than by counting intervals, because a
   * backgrounded tab throttles timers to once a second and a counted clock
   * would stretch an eight second coffee into a minute. Sounds fire on steps
   * the elapsed time has just crossed, so a long frame skips a noise rather
   * than replaying the sequence out of order.
   */
  useEffect(() => {
    if (!order || order.done) return
    const started = Date.now() - order.elapsed * 1000
    const steps = stepsFor(order.item)
    const ready = readyAt(order.item)
    let last = order.elapsed

    const id = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000
      if (soundOn) {
        for (const step of crossed(steps, last, elapsed)) {
          if (step.sound) kitchen.current?.play(step.sound, step.seconds)
        }
      }
      last = elapsed
      setOrder((o) => (o && !o.done ? { ...o, elapsed, done: elapsed >= ready } : o))
    }, 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.item.id, order?.done, soundOn])

  const sit = useCallback((i: number) => {
    setSeatIndex(i)
    setMenuOpen(false)
  }, [])

  const stand = useCallback(() => {
    setSeatIndex(null)
    setMenuOpen(false)
  }, [])

  const orderItem = useCallback(
    (item: Item) => {
      if (!kitchen.current) kitchen.current = new Kitchen()
      if (soundOn) void kitchen.current.resume()
      setMenuOpen(false)
      setOrder({
        item,
        where: seatIndex === null ? 'counter' : 'table',
        elapsed: 0,
        done: false,
      })
    },
    [seatIndex, soundOn],
  )

  // Wind at the barn drives the wind in the room.
  useEffect(() => {
    ambience.current?.update({ windKph: place.weather?.windKph })
  }, [place.weather?.windKph])

  const toggleSound = useCallback(async () => {
    if (!ambience.current) ambience.current = new Ambience()
    if (ambience.current.isRunning) {
      await ambience.current.stop()
      setSoundOn(false)
    } else {
      await ambience.current.start({ windKph: place.weather?.windKph })
      setSoundOn(true)
    }
  }, [place.weather?.windKph])

  const toggleRadio = useCallback(() => {
    if (!radio.current) radio.current = new Radio()
    const r = radio.current
    if (r.isPlaying) {
      r.stop()
      setRadioState({ playing: false, loading: false })
      return
    }
    void r.play(setRadioState)
  }, [])

  // Somewhere else in the world.
  const nextPlace = useCallback(() => {
    if (!radio.current) radio.current = new Radio()
    void radio.current.nextPlace(setRadioState)
  }, [])

  // Another station in the same country.
  const nextStation = useCallback(() => {
    if (!radio.current) radio.current = new Radio()
    void radio.current.nextStation(setRadioState)
  }, [])

  const daylight = useMemo(() => daylightAt(hour, place.solar), [hour, place.solar])

  /*
   * The room's light, pushed into CSS custom properties for the chrome.
   *
   * Written straight onto documentElement rather than held in React state on
   * purpose: this changes every time the hour moves, and re-rendering the
   * whole app to repaint a border colour would be absurd. Lifted well clear
   * of black first — fogColor at 3am is almost nothing, and a pane tinted
   * with nothing is a pane tinted grey.
   */
  const onLight = useCallback((c: THREE.Color) => {
    const lift = (v: number) => Math.round(Math.min(1, v * 0.55 + 0.3) * 255)
    const el = document.documentElement
    el.style.setProperty('--room-r', String(lift(c.r)))
    el.style.setProperty('--room-g', String(lift(c.g)))
    el.style.setProperty('--room-b', String(lift(c.b)))
  }, [])

  /*
   * Which board is in the case.
   *
   * Four photographs of a morning's bake, keyed on the local date rather than
   * picked at random. Random would change under you between sitting down and
   * ordering, and would mean two people in the same room on the same morning
   * were looking at different pastries — which is a small lie but is the kind
   * this place is built not to tell. It rolls over at local midnight, so two
   * visitors in different time zones can disagree for a few hours; that is the
   * same thing the daylight model already does and is the correct answer for
   * both.
   */
  const plate = useMemo(() => {
    const now = new Date()
    const day = Math.floor(
      (now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000,
    )
    return `${import.meta.env.BASE_URL}img/pastries-${((day % 4) + 4) % 4}.jpg`
  }, [])

  const conditions = place.weather
    ? ` · ${Math.round(place.weather.temperatureC)}°C ${place.weather.label}`
    : ''

  return (
    <main className="shop" data-seated={seatIndex !== null}>
      <Scene
        hour={hour}
        daylight={daylight}
        solar={place.solar}
        weather={place.weather}
        radioLabel={radioState.playing ? 'turn it off' : 'put the radio on'}
        onToggleRadio={toggleRadio}
        napkins={napkins}
        peers={peers}
        bake={bake}
        onStation={setStation}
        onReady={() => setReady(true)}
        onLight={onLight}
        onProgress={(p) => {
          if (p > 0.04 && !walked) setWalked(true)
        }}
        seat={seatIndex === null ? null : SEATS[seatIndex]}
        seatIndex={seatIndex}
        onSit={sit}
        served={
          order?.done
            ? {
                tray:
                  order.where === 'table' && seatIndex !== null
                    ? SEATS[seatIndex].tray
                    : COUNTER_TRAY,
                kind: order.item.kind,
              }
            : null
        }
        grinding={isGrinding(order)}
      />

      {/*
       * The grain and the vignette.
       *
       * Both were written for this and then never mounted — the stylesheet
       * has carried the rules since the first pass with nothing rendering
       * them. They belong between the room and the chrome: the render is a
       * photograph, and a photograph has edges that fall off and a surface
       * that is not perfectly clean. Without them the WebGL frame meets the
       * window edge at full brightness, which is the single most reliable
       * tell that you are looking at a canvas rather than at a picture.
       */}
      <div className="vignette" aria-hidden />
      <div className="grain" aria-hidden />

      <Arrival ready={ready} />

      <header className="sign">
        <h1>
          <span>Near</span>
          <span>Coffee</span>
        </h1>
        <p>Mormon Row, Wyoming · open whenever you are</p>
      </header>


      <div className="wall">
        {writing ? (
          <div className="wall-form">
            <input
              autoFocus
              value={draft}
              maxLength={MAX_LENGTH}
              placeholder="one line, then it is on the wall"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void pin()
                if (e.key === 'Escape') setWriting(false)
              }}
              aria-label="Write a note for the wall"
            />
            <span className="wall-count">{MAX_LENGTH - draft.length}</span>
            <button className="btn on" onClick={() => void pin()}>
              pin it
            </button>
            <button className="btn ghost" onClick={() => setWriting(false)}>
              never mind
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => setWriting(true)}>
            leave a note
          </button>
        )}
        <span className="wall-note">
          {wallNote ||
            (napkins.length
              ? `${napkins.length} on the wall · gone in ${LIFETIME_DAYS} days`
              : `nothing pinned yet · notes fade after ${LIFETIME_DAYS} days`)}
          {!wall.current.shared && ' · only you can see these'}
        </span>
      </div>

      <div className="controls">
        <button
          className={`btn ${soundOn ? 'on' : ''}`}
          onClick={toggleSound}
          aria-pressed={soundOn}
          title={soundOn ? 'silence the café' : 'listen to the café'}
        >
          {soundOn ? 'sound on' : 'sound off'}
        </button>
        <button
          className={`btn ${radioState.playing ? 'on' : ''}`}
          onClick={toggleRadio}
          aria-pressed={radioState.playing}
        >
          {radioState.loading ? 'tuning…' : radioState.playing ? 'radio on' : 'radio off'}
        </button>
        {(radioState.playing || radioState.error) && (
          <>
            <button className="btn ghost" onClick={nextPlace} title="somewhere else in the world">
              elsewhere
            </button>
            <button className="btn ghost" onClick={nextStation} title="another station here">
              next
            </button>
          </>
        )}
        {(radioState.playing || radioState.loading || radioState.error) && (
          <span className="now-playing">
            {radioState.error
              ? `${radioState.place ?? ''} — ${radioState.error}`
              : radioState.playing
                ? `${radioState.place} · ${radioState.station}`
                : `tuning ${radioState.place ?? ''}…`}
          </span>
        )}
      </div>

      {/*
       * One stack at the foot of the frame. The hint, the clock and the
       * station label used to be three separately-positioned elements that
       * happened to land near each other, and at 1440x900 they printed
       * straight across the saucer.
       */}
      <div className="foot">
        {/* Two wordings, swapped by the stylesheet. The long one does not fit
            on one line at 390px and a two-line hint pushes the whole foot
            stack up into the room. */}
        <div className={`hint ${walked ? 'gone' : ''}`}>
          <span className="wide-only">drag to look · tap the floor to walk</span>
          <span className="narrow-only">tap the floor to walk</span>
        </div>
        <div className="foot-row">
          <div className={`clock ${panelOpen ? 'open' : ''}`}>
        <button className="clock-face" onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
          <span className="clock-time">{formatHour(hour)}</span>
          <span className="clock-meta">
            {daylight.label}
            {conditions}
          </span>
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
              className="btn ghost"
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
        </div>
        <div className={`station ${walked ? 'shown' : ''}`}>{station}</div>
      </div>

      {seatIndex !== null && (
        <div className="seat-panel">
          <span className="seat-kicker">seated</span>
          <h2>{SEATS[seatIndex].label}</h2>
          <p>{SEATS[seatIndex].passage}</p>

          {order && (
            <p className={`order-status ${order.done ? 'done' : ''}`}>
              {statusLine(order)}
            </p>
          )}

          {menuOpen ? (
            <>
              {/*
               * A photograph of the morning's bake at the head of the menu.
               * Loaded lazily and decoded async because it only ever appears
               * two taps in, and it must not be competing for bandwidth with
               * the room during the arrival sequence. Which of the four
               * boards it is depends on the date — see `plate` above.
               */}
              <div className="menu-plate">
                <img
                  src={plate}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="menu-plate-label">out of the oven</span>
              </div>
              <ul className="menu">
                {MENU.map((item, i) => (
                  <li key={item.id}>
                    <button onClick={() => orderItem(item)}>
                      <span className="menu-no">{String(i + 1).padStart(2, '0')}</span>
                      <span className="menu-name">{item.name}</span>
                      <span className="menu-price">${item.price}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="seat-actions">
              <button
                className="btn on"
                onClick={() => setMenuOpen(true)}
                disabled={!!order && !order.done}
              >
                {order && !order.done ? 'coming up…' : 'order something'}
              </button>
              <button className="btn ghost" onClick={stand}>
                stand up
              </button>
            </div>
          )}

          {menuOpen && (
            <button className="btn ghost" onClick={() => setMenuOpen(false)}>
              never mind
            </button>
          )}
        </div>
      )}

      <div className="presence-note">
        {peers.length === 0
          ? 'you have the place to yourself'
          : peers.length === 1
            ? 'someone else is here'
            : `${peers.length} others are here`}
        {!presence.current.shared && ' · this browser only'}
      </div>

      {place.solar && (
        <div className="place-note">
          live from mormon row, wyoming · sun {formatHour(place.solar.sunrise)}–
          {formatHour(place.solar.sunset)}
          {place.solar.moonPhase ? ` · ${place.solar.moonPhase.toLowerCase()} moon` : ''}
        </div>
      )}
    </main>
  )
}
