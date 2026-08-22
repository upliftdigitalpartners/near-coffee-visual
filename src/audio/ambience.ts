/**
 * The sound of the room, synthesised rather than sampled.
 *
 * A field recording would be more convincing, but it would also be several
 * megabytes, would need a licence that survives commercial use, and would loop
 * — and a loop in a quiet room is the most noticeable thing in the world once
 * you hear it. Everything here is noise shaped by filters, so it never repeats,
 * costs a few kilobytes, and belongs to nobody.
 *
 * The wind is driven by the actual wind speed at Mormon Row, which is the
 * whole reason to bother: on a still day the barn is nearly silent, and when
 * it is blowing outside you can hear it in the boards.
 *
 * Nothing here starts without a user gesture. Browsers block autoplay with
 * sound, correctly, and a coffee shop that shouts at you on arrival is not
 * one you would sit down in.
 */

/** Seconds of noise generated up front and looped through the filters. */
const NOISE_SECONDS = 4

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * NOISE_SECONDS
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  /*
   * Brown-ish noise rather than white. Integrating white noise tilts the
   * spectrum down at ~6dB/octave, which is much closer to wind and room tone;
   * raw white noise sounds like a television.
   */
  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return buffer
}

export type AmbienceOptions = {
  /** km/h at the barn. */
  windKph?: number
  /** 0–1: how much the stove is going. */
  stove?: number
}

export class Ambience {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private windGain: GainNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private crackleTimer: number | null = null
  private buffer: AudioBuffer | null = null
  private windKph = 6
  private stove = 0.5
  private running = false

  get isRunning() {
    return this.running
  }

  /** Must be called from a user gesture. */
  async start(opts: AmbienceOptions = {}) {
    if (this.running) return
    this.windKph = opts.windKph ?? this.windKph
    this.stove = opts.stove ?? this.stove

    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    await ctx.resume()

    this.ctx = ctx
    this.buffer = noiseBuffer(ctx)

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master

    // ---- wind through the gaps in the siding -------------------------------
    const wind = ctx.createBufferSource()
    wind.buffer = this.buffer
    wind.loop = true

    const windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 420
    windFilter.Q.value = 0.7

    const windGain = ctx.createGain()
    windGain.gain.value = 0

    wind.connect(windFilter).connect(windGain).connect(master)
    wind.start()
    this.windFilter = windFilter
    this.windGain = windGain

    /*
     * Two slow LFOs on the filter, at frequencies that do not divide into each
     * other. Gusts then never land on the same beat twice, which is what stops
     * it reading as a loop.
     */
    const gust = ctx.createOscillator()
    gust.frequency.value = 0.07
    const gustDepth = ctx.createGain()
    gustDepth.gain.value = 180
    gust.connect(gustDepth).connect(windFilter.frequency)
    gust.start()

    const sway = ctx.createOscillator()
    sway.frequency.value = 0.031
    const swayDepth = ctx.createGain()
    swayDepth.gain.value = 0.16
    sway.connect(swayDepth).connect(windGain.gain)
    sway.start()

    // ---- room tone ---------------------------------------------------------
    const room = ctx.createBufferSource()
    room.buffer = this.buffer
    room.loop = true
    const roomFilter = ctx.createBiquadFilter()
    roomFilter.type = 'lowpass'
    roomFilter.frequency.value = 140
    const roomGain = ctx.createGain()
    roomGain.gain.value = 0.09
    room.connect(roomFilter).connect(roomGain).connect(master)
    room.start()

    this.applyWind()
    this.scheduleCrackle()

    // Fade in, rather than arriving.
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 1.4)
    this.running = true
  }

  /** Wood stove: irregular pops, each one a short filtered burst. */
  private scheduleCrackle() {
    const tick = () => {
      const ctx = this.ctx
      const master = this.master
      if (!ctx || !master || !this.buffer) return

      if (Math.random() < this.stove) {
        const src = ctx.createBufferSource()
        src.buffer = this.buffer
        src.playbackRate.value = 1.6 + Math.random() * 1.2
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900 + Math.random() * 1900
        bp.Q.value = 3.5
        const g = ctx.createGain()
        const now = ctx.currentTime
        const peak = 0.05 + Math.random() * 0.12
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(peak, now + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + Math.random() * 0.1)
        src.connect(bp).connect(g).connect(master)
        const offset = Math.random() * (NOISE_SECONDS - 0.3)
        src.start(now, offset, 0.25)
        src.stop(now + 0.3)
      }
      this.crackleTimer = window.setTimeout(tick, 120 + Math.random() * 900)
    }
    tick()
  }

  private applyWind() {
    if (!this.ctx || !this.windGain || !this.windFilter) return
    /*
     * Open-Meteo reports km/h. Calm here is genuinely calm — around 2km/h
     * today — and 40km/h is a serious blow across Antelope Flats.
     */
    const strength = Math.min(1, Math.max(0, this.windKph / 38))
    const level = 0.06 + strength * 0.5
    const brightness = 320 + strength * 900
    const t = this.ctx.currentTime
    this.windGain.gain.setTargetAtTime(level, t, 2)
    this.windFilter.frequency.setTargetAtTime(brightness, t, 2)
  }

  update(opts: AmbienceOptions) {
    if (opts.windKph !== undefined) this.windKph = opts.windKph
    if (opts.stove !== undefined) this.stove = opts.stove
    if (this.running) this.applyWind()
  }

  setVolume(v: number) {
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2)
  }

  async stop() {
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3)
    if (this.crackleTimer) window.clearTimeout(this.crackleTimer)
    const ctx = this.ctx
    window.setTimeout(() => void ctx.close(), 900)
    this.ctx = null
    this.master = null
    this.running = false
  }
}
