/**
 * The noises a coffee comes with.
 *
 * Synthesised, like everything else in `src/audio/` — there are no files to
 * ship, and a grinder is easier to build than to license. Three sounds:
 *
 *   grind  band-passed noise with the band swept downward, because a burr
 *          grinder starts high and empty and drops in pitch as beans load it
 *   hiss   narrower noise, for the shot and the steam wand
 *   chime  three notes, for the moment it lands
 *
 * All of it is gated on the same sound toggle as the room tone. Nothing here
 * makes a sound the visitor has not asked for.
 */

export class Kitchen {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null

  /** Shares nothing with Ambience: separate contexts are fine and simpler. */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)

    /*
     * Two seconds of white noise, reused for every burst. Generating fresh
     * noise per sound is pure waste — nobody can hear that the grinder and the
     * steam wand are chewing the same random numbers.
     */
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

    this.ctx = ctx
    this.master = master
    this.noise = buf
    return ctx
  }

  async resume() {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') await ctx.resume()
  }

  /** A burst of band-passed noise, with the band swept over its life. */
  private burst(seconds: number, from: number, to: number, q: number, gain: number) {
    const ctx = this.ensure()
    if (!ctx || !this.noise || !this.master) return
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = q
    band.frequency.setValueAtTime(from, t)
    band.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + seconds)

    const env = ctx.createGain()
    /*
     * A 60ms attack and a long tail. Starting at zero gain and ramping is not
     * optional — a noise source switched on at full level clicks, and the click
     * is louder than the sound it introduces.
     */
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.06)
    env.gain.setValueAtTime(gain, t + seconds - 0.12)
    env.gain.exponentialRampToValueAtTime(0.0001, t + seconds)

    src.connect(band).connect(env).connect(this.master)
    src.start(t)
    src.stop(t + seconds + 0.05)
  }

  grind(seconds = 1.9) {
    this.burst(seconds, 1800, 320, 3.2, 0.16)
  }

  hiss(seconds = 3.4) {
    this.burst(seconds, 5200, 3400, 1.1, 0.075)
  }

  /** Three notes, up. The sound of something being set down in front of you. */
  chime() {
    const ctx = this.ensure()
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    ;[0, 0.11, 0.22].forEach((delay, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = [784, 988, 1319][i]
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, t + delay)
      env.gain.exponentialRampToValueAtTime(0.09, t + delay + 0.02)
      env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9)
      osc.connect(env).connect(this.master!)
      osc.start(t + delay)
      osc.stop(t + delay + 1.0)
    })
  }

  play(kind: 'grind' | 'hiss' | 'chime', seconds?: number) {
    if (kind === 'grind') this.grind(seconds)
    else if (kind === 'hiss') this.hiss(seconds)
    else this.chime()
  }

  async close() {
    await this.ctx?.close()
    this.ctx = null
    this.master = null
    this.noise = null
  }
}
