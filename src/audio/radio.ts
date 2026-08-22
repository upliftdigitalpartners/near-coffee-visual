/**
 * The radio on the counter.
 *
 * Press it and you are in the barn. Press next and you are somewhere else in
 * the world — Dhaka, Reykjavík, Dakar — listening to whatever is actually on
 * air there at this moment. Same idea as spinning a globe.
 *
 * Not Radio Garden. Their station API is undocumented, returns 403 to anything
 * that is not their own front end, and they publish no terms permitting use.
 * Building on it would mean working around a deliberate block on somebody
 * else's private endpoint, from a domain with Fahim's name on it, and it would
 * break the first time they changed anything. Radio Browser is a community
 * project with an open API, CORS enabled for any origin, and country filtering
 * built in — it does the same job and is meant to be used this way.
 *
 * Two constraints shape everything here:
 *
 *   HTTPS only. The site is served over TLS and a plain http:// stream is
 *   blocked as mixed content, which rules out most of what the directory lists.
 *
 *   Community-listed streams die. Constantly. So tuning to a place tries its
 *   stations in turn rather than trusting the first one, which is the whole
 *   difference between this feeling alive and feeling broken.
 */

const API = 'https://de1.api.radio-browser.info/json/stations/search'
/** Codecs a browser will actually decode. */
const CODECS = ['MP3', 'AAC', 'AAC+']
/** How many dead stations to walk past before giving up on a place. */
const MAX_TRIES = 4

export type Station = {
  name: string
  /**
   * Whose signal this is, shown while playing. Empty for stations pulled from
   * the directory — there the place is already on screen, and repeating it
   * gives you "Bangladesh · A2Z RADIO · Bangladesh".
   */
  attribution: string
  url: string
}

export type Place = {
  label: string
  /** ISO country code for Radio Browser; absent for the hand-picked house set. */
  cc?: string
  /** Pre-set stations, used for the house. */
  stations?: Station[]
}

/*
 * The house set is hand-checked and reliable, and is what you get first. Both
 * operators are listener-supported and publish stream URLs for third-party
 * players; check their terms before this becomes a commercial site.
 */
const HOUSE: Station[] = [
  { name: 'Groove Salad', attribution: 'SomaFM', url: 'https://ice2.somafm.com/groovesalad-128-mp3' },
  { name: 'Adroit Jazz Underground', attribution: 'WalmRadio', url: 'https://icecast.walmradio.com:8443/jazz' },
  { name: 'Classic Vinyl', attribution: 'WalmRadio', url: 'https://icecast.walmradio.com:8443/classic' },
  { name: 'Secret Agent', attribution: 'SomaFM', url: 'https://ice6.somafm.com/secretagent-128-mp3' },
]

/**
 * Where the dial goes. Countries rather than cities, because that is what the
 * directory actually filters on and it would be a small lie to label a station
 * "Dhaka" when all we know is "Bangladesh".
 */
export const PLACES: Place[] = [
  { label: 'the house', stations: HOUSE },
  { label: 'Bangladesh', cc: 'BD' },
  { label: 'Japan', cc: 'JP' },
  { label: 'Brazil', cc: 'BR' },
  { label: 'Iceland', cc: 'IS' },
  { label: 'Senegal', cc: 'SN' },
  { label: 'Portugal', cc: 'PT' },
  { label: 'India', cc: 'IN' },
  { label: 'Ethiopia', cc: 'ET' },
  { label: 'Mexico', cc: 'MX' },
  { label: 'Türkiye', cc: 'TR' },
  { label: 'Norway', cc: 'NO' },
  { label: 'France', cc: 'FR' },
]

export type RadioState = {
  playing: boolean
  loading: boolean
  /** "Groove Salad · SomaFM" */
  station?: string
  /** "the house" */
  place?: string
  error?: string
}

type Notify = (s: RadioState) => void

export class Radio {
  private el: HTMLAudioElement | null = null
  private placeIndex = 0
  private stationIndex = 0
  private cache = new Map<string, Station[]>()
  /**
   * Set from the element's own `playing` event, never from `el.paused`.
   * A stream that is merely *attempting* reports paused === false, so trusting
   * that makes the button say "stop" when nothing is playing — and the next
   * click then kills a retry instead of starting one.
   */
  private started = false
  /** Bumped on every tune, so a slow fetch cannot hijack a later one. */
  private token = 0

  get place(): Place {
    return PLACES[this.placeIndex]
  }

  get isPlaying(): boolean {
    return this.started
  }

  private async stationsFor(place: Place): Promise<Station[]> {
    if (place.stations) return place.stations
    const cached = this.cache.get(place.cc!)
    if (cached) return cached

    const url =
      `${API}?countrycode=${place.cc}&hidebroken=true&order=votes&reverse=true&limit=60`
    const res = await fetch(url)
    if (!res.ok) throw new Error('the directory is not answering')
    const rows: Array<Record<string, unknown>> = await res.json()

    const stations: Station[] = rows
      .filter(
        (s) =>
          typeof s.url_resolved === 'string' &&
          s.url_resolved.startsWith('https://') &&
          CODECS.includes(String(s.codec)),
      )
      .map((s) => ({
        name: String(s.name).trim().slice(0, 44) || 'unnamed',
        attribution: '',
        url: String(s.url_resolved),
      }))

    this.cache.set(place.cc!, stations)
    return stations
  }

  /** Play the current place, walking past dead stations. Needs a user gesture. */
  async play(notify?: Notify) {
    const mine = ++this.token
    this.started = false
    const place = this.place
    notify?.({ playing: false, loading: true, place: place.label })

    let stations: Station[]
    try {
      stations = await this.stationsFor(place)
    } catch {
      notify?.({ playing: false, loading: false, place: place.label, error: 'could not reach the directory' })
      return
    }
    if (this.token !== mine) return
    if (!stations.length) {
      notify?.({ playing: false, loading: false, place: place.label, error: 'nothing on air there' })
      return
    }

    for (let attempt = 0; attempt < Math.min(MAX_TRIES, stations.length); attempt++) {
      if (this.token !== mine) return
      const station = stations[(this.stationIndex + attempt) % stations.length]
      const ok = await this.tune(station, place, mine, notify)
      if (ok) {
        this.stationIndex = (this.stationIndex + attempt) % stations.length
        return
      }
    }
    if (this.token === mine) {
      notify?.({ playing: false, loading: false, place: place.label, error: 'nothing there would play' })
    }
  }

  /** Resolves true once the element is actually producing audio. */
  private tune(station: Station, place: Place, mine: number, notify?: Notify): Promise<boolean> {
    if (!this.el) {
      this.el = new Audio()
      this.el.preload = 'none'
      this.el.volume = 0.55
    }
    const el = this.el
    const label = station.attribution
      ? `${station.name} · ${station.attribution}`
      : station.name

    return new Promise((resolve) => {
      let settled = false
      const done = (ok: boolean) => {
        if (settled) return
        settled = true
        el.onplaying = el.onerror = el.onstalled = null
        clearTimeout(timer)
        resolve(ok)
      }

      el.onplaying = () => {
        if (this.token !== mine) return done(false)
        this.started = true
        notify?.({ playing: true, loading: false, station: label, place: place.label })
        done(true)
      }
      el.onerror = () => done(false)
      el.onstalled = () => done(false)
      // A stream that has not started in eight seconds is not going to.
      const timer = setTimeout(() => done(false), 8000)

      notify?.({ playing: false, loading: true, station: label, place: place.label })
      el.src = station.url
      el.load()
      el.play().catch(() => done(false))
    })
  }

  /** Somewhere else in the world. */
  async nextPlace(notify?: Notify) {
    this.placeIndex = (this.placeIndex + 1) % PLACES.length
    this.stationIndex = 0
    if (this.el) this.el.pause()
    await this.play(notify)
  }

  /** Another station in the same place. */
  async nextStation(notify?: Notify) {
    this.stationIndex += 1
    await this.play(notify)
  }

  stop() {
    this.token++
    this.started = false
    if (!this.el) return
    this.el.pause()
    this.el.removeAttribute('src')
    this.el.load()
  }

  setVolume(v: number) {
    if (this.el) this.el.volume = Math.min(1, Math.max(0, v))
  }
}
