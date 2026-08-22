/**
 * The radio on the counter.
 *
 * The original plan for this was "everyone hears the same track at the same
 * timestamp", which needed a server to hold the clock. It turns out not to:
 * a live internet stream is *already* synchronised, because it is one
 * broadcast. Two people in the room at once hear the same bar of the same
 * song for the same reason two people in a real cafe do.
 *
 * Played through a plain <audio> element, deliberately. Routing it through
 * the Web Audio graph would let us mix it against the ambience properly, but
 * it would also require CORS headers that these stations do not send, and the
 * stream would go silent. Element volume is enough.
 *
 * Stations were checked by hand for HTTPS — nearcoffee.space is served over
 * TLS and a plain http:// stream is blocked as mixed content, which accounts
 * for most of what is listed on the public directories.
 */

export type Station = {
  id: string
  name: string
  /** Shown under the name; whose signal this actually is. */
  attribution: string
  url: string
}

/*
 * Kept short and hand-picked. SomaFM and WalmRadio are both listener-supported
 * and both publish their stream URLs for third-party players; the station name
 * is always shown while playing, which is the least they are owed. Check each
 * station's terms before this becomes a commercial site.
 */
export const STATIONS: Station[] = [
  {
    id: 'groovesalad',
    name: 'Groove Salad',
    attribution: 'SomaFM',
    url: 'https://ice2.somafm.com/groovesalad-128-mp3',
  },
  {
    id: 'jazz',
    name: 'Adroit Jazz Underground',
    attribution: 'WalmRadio',
    url: 'https://icecast.walmradio.com:8443/jazz',
  },
  {
    id: 'classic',
    name: 'Classic Vinyl',
    attribution: 'WalmRadio',
    url: 'https://icecast.walmradio.com:8443/classic',
  },
  {
    id: 'secretagent',
    name: 'Secret Agent',
    attribution: 'SomaFM',
    url: 'https://ice6.somafm.com/secretagent-128-mp3',
  },
  {
    id: 'deepspace',
    name: 'Deep Space One',
    attribution: 'SomaFM',
    url: 'https://ice4.somafm.com/deepspaceone-128-mp3',
  },
]

export class Radio {
  private el: HTMLAudioElement | null = null
  private index = 0

  get station(): Station {
    return STATIONS[this.index]
  }

  get isPlaying(): boolean {
    return !!this.el && !this.el.paused
  }

  /** Must be called from a user gesture. */
  async play(onState?: (s: { playing: boolean; loading: boolean; error?: string }) => void) {
    if (!this.el) {
      const el = new Audio()
      el.preload = 'none'
      el.volume = 0.55
      this.el = el
    }
    const el = this.el
    el.src = this.station.url
    /*
     * Explicit load(). With preload='none' some browsers will not begin
     * fetching a live stream on play() alone, and the element sits in
     * NETWORK_NO_SOURCE looking exactly like a dead station.
     */
    el.load()
    onState?.({ playing: false, loading: true })

    el.onplaying = () => onState?.({ playing: true, loading: false })
    el.onwaiting = () => onState?.({ playing: false, loading: true })
    el.onerror = () =>
      onState?.({ playing: false, loading: false, error: 'that station is not answering' })

    try {
      await el.play()
    } catch {
      onState?.({ playing: false, loading: false, error: 'the browser would not start it' })
    }
  }

  stop() {
    if (!this.el) return
    this.el.pause()
    // Detach the source or the connection stays open in the background.
    this.el.removeAttribute('src')
    this.el.load()
  }

  next(onState?: (s: { playing: boolean; loading: boolean; error?: string }) => void) {
    const was = this.isPlaying
    this.index = (this.index + 1) % STATIONS.length
    if (was) void this.play(onState)
  }

  setVolume(v: number) {
    if (this.el) this.el.volume = Math.min(1, Math.max(0, v))
  }
}
