/**
 * The daylight model.
 *
 * Near Coffee sits on a moraine on the east side of Jackson Hole, and the
 * window faces west at the Teton range. That orientation decides everything
 * about how light behaves here, and it is worth stating plainly because the
 * whole scene is built on it:
 *
 *   - The sun rises BEHIND the building. At dawn it rakes across the peak
 *     faces and they burn pink while the sky is still night. Alpenglow.
 *   - Through the middle of the day the peaks are lit flat, and granite is
 *     darker than the sky behind it — so the range reads as a solid mass,
 *     not as pale cutouts.
 *   - The sun sets BEHIND the peaks. They collapse to silhouette against a
 *     sky doing something enormous, and for about an hour beforehand the low
 *     sun is in front of the window — the only time of day a real shaft of
 *     light crosses the floor.
 *   - At night the range is a slightly-less-black shape against stars, and
 *     the oil lamp on the counter is the brightest thing in the world.
 *
 * Everything below is keyframes on a 24h clock, linearly interpolated. Times
 * are deliberately "mountain summer" rather than astronomically exact — this
 * is a mood, not an ephemeris.
 */

export type Daylight = {
  /** Sky gradient, top of frame down to the horizon. */
  skyTop: string
  skyMid: string
  skyHorizon: string
  /** Light landing on the summits. Granite: keep it darker than skyHorizon. */
  peakLight: string
  /** The range's own shadowed rock, down at the bases. */
  peakShadow: string
  /** Atmospheric haze stacked against the foot of the range. */
  haze: string
  /** Sagebrush flats between the window and the range. */
  flats: string
  /** Ambient bounce filling the stone room. */
  interiorAmbient: string
  /** Warm pool thrown by the oil lamp. 0..1 */
  lampIntensity: number
  /** Direct low sun crossing the floor. 0..1, only late in the day. */
  shaftIntensity: number
  /** Colour of that shaft. */
  shaftColor: string
  /** Stars. 0..1 */
  starOpacity: number
  /**
   * The bowl of light the sun leaves behind the range after it drops. Near
   * zero for most of the day — left running full-time it flattens the whole
   * sky to cream, which is exactly what it did the first time.
   */
  afterglow: number
  /** How strongly the window bleeds light onto the surrounding stone. 0..1 */
  windowBloom: number
  /** Human-readable, shown quietly in the corner. */
  label: string
}

type Keyframe = Daylight & { at: number }

const NIGHT: Omit<Keyframe, 'at'> = {
  label: 'deep night',
  skyTop: '#05070f',
  skyMid: '#0a0e1c',
  skyHorizon: '#111a2e',
  peakLight: '#1e2740',
  peakShadow: '#090d18',
  haze: '#0e1424',
  flats: '#080a12',
  interiorAmbient: '#1d1409',
  lampIntensity: 1,
  shaftIntensity: 0,
  shaftColor: '#ffd9a0',
  starOpacity: 1,
  afterglow: 0,
  windowBloom: 0.05,
}

const KEYFRAMES: Keyframe[] = [
  { at: 0, ...NIGHT },
  {
    at: 4.5,
    label: 'first light',
    skyTop: '#090f22',
    skyMid: '#14203e',
    skyHorizon: '#2c3558',
    peakLight: '#2b3050',
    peakShadow: '#101427',
    haze: '#1f2846',
    flats: '#0d1018',
    interiorAmbient: '#1f1710',
    lampIntensity: 0.95,
    shaftIntensity: 0,
    shaftColor: '#ffd9a0',
    starOpacity: 0.55,
    afterglow: 0.14,
    windowBloom: 0.12,
  },
  {
    at: 5.9,
    label: 'alpenglow',
    skyTop: '#16224a',
    skyMid: '#2e3a68',
    skyHorizon: '#6a5478',
    // The whole reason to get up early. Summits only — the gradient in
    // View.tsx keeps the bases in shadow, which is what makes it read.
    peakLight: '#e0805f',
    peakShadow: '#322842',
    haze: '#453e62',
    flats: '#191820',
    interiorAmbient: '#2c1d13',
    lampIntensity: 0.7,
    shaftIntensity: 0,
    shaftColor: '#ffc79a',
    starOpacity: 0.15,
    afterglow: 0.4,
    windowBloom: 0.3,
  },
  {
    at: 7,
    label: 'early morning',
    skyTop: '#2e63a8',
    skyMid: '#6d98c4',
    skyHorizon: '#a8bcc4',
    peakLight: '#a89681',
    peakShadow: '#454452',
    haze: '#8fa4b2',
    flats: '#45412f',
    interiorAmbient: '#3a2a1b',
    lampIntensity: 0.35,
    shaftIntensity: 0,
    shaftColor: '#ffe0b8',
    starOpacity: 0,
    afterglow: 0.08,
    windowBloom: 0.55,
  },
  {
    at: 10,
    label: 'morning',
    skyTop: '#2569b4',
    skyMid: '#6b9ecb',
    skyHorizon: '#a9bcc2',
    peakLight: '#a89c8c',
    peakShadow: '#4e4d59',
    haze: '#93a8b4',
    flats: '#625938',
    interiorAmbient: '#463322',
    lampIntensity: 0.12,
    shaftIntensity: 0,
    shaftColor: '#ffeccd',
    starOpacity: 0,
    afterglow: 0,
    windowBloom: 0.75,
  },
  {
    at: 13,
    label: 'midday',
    skyTop: '#1a60b6',
    skyMid: '#5f9ad2',
    skyHorizon: '#aec1c4',
    peakLight: '#b0a696',
    peakShadow: '#55545f',
    haze: '#9db1bd',
    flats: '#6f6444',
    interiorAmbient: '#4b3826',
    lampIntensity: 0.06,
    shaftIntensity: 0,
    shaftColor: '#fff3dc',
    starOpacity: 0,
    afterglow: 0,
    windowBloom: 0.85,
  },
  {
    at: 16.5,
    label: 'afternoon',
    skyTop: '#326bb0',
    skyMid: '#79a7cf',
    skyHorizon: '#bcbfb4',
    peakLight: '#9c8e79',
    peakShadow: '#47434f',
    haze: '#9aa8ac',
    flats: '#6f6140',
    interiorAmbient: '#523823',
    lampIntensity: 0.08,
    shaftIntensity: 0.25,
    shaftColor: '#ffe6bb',
    starOpacity: 0,
    afterglow: 0.06,
    windowBloom: 0.8,
  },
  {
    // Without this the golden ramp starts straight after lunch and half past
    // five already looks like sunset.
    at: 18.2,
    label: 'late afternoon',
    skyTop: '#3a6cad',
    skyMid: '#85a8c8',
    skyHorizon: '#c8bfa8',
    peakLight: '#93836d',
    peakShadow: '#423e4a',
    haze: '#9ba49f',
    flats: '#6b5c3a',
    interiorAmbient: '#563a22',
    lampIntensity: 0.1,
    shaftIntensity: 0.45,
    shaftColor: '#ffdca6',
    starOpacity: 0,
    afterglow: 0.12,
    windowBloom: 0.82,
  },
  {
    at: 19.7,
    label: 'golden hour',
    skyTop: '#3f68a6',
    skyMid: '#b9825f',
    skyHorizon: '#e8a468',
    // Sun dropping behind the range: faces going flat and dark.
    peakLight: '#6b584a',
    peakShadow: '#2e2833',
    haze: '#b98a6c',
    flats: '#5c4a2c',
    interiorAmbient: '#5c3a1e',
    lampIntensity: 0.2,
    shaftIntensity: 1,
    shaftColor: '#ffbe72',
    starOpacity: 0,
    afterglow: 0.55,
    windowBloom: 0.9,
  },
  {
    at: 20.4,
    label: 'sunset',
    skyTop: '#263a6e',
    skyMid: '#a2555f',
    skyHorizon: '#ee8450',
    // Pure silhouette. The peaks are just a hole in the sky.
    peakLight: '#2f2733',
    peakShadow: '#1c1726',
    haze: '#8d4f63',
    flats: '#322820',
    interiorAmbient: '#4a2a17',
    lampIntensity: 0.45,
    shaftIntensity: 0.65,
    shaftColor: '#ff9a5c',
    starOpacity: 0,
    afterglow: 0.95,
    windowBloom: 0.7,
  },
  {
    at: 21.3,
    label: 'dusk',
    skyTop: '#131d43',
    skyMid: '#3a3a6a',
    skyHorizon: '#855570',
    peakLight: '#1f1f30',
    peakShadow: '#101021',
    haze: '#2a2542',
    flats: '#191618',
    interiorAmbient: '#33200f',
    lampIntensity: 0.8,
    shaftIntensity: 0.1,
    shaftColor: '#ff9a6c',
    starOpacity: 0.35,
    afterglow: 0.45,
    windowBloom: 0.35,
  },
  {
    at: 22.6,
    label: 'night',
    skyTop: '#070a16',
    skyMid: '#0b1020',
    skyHorizon: '#151d32',
    peakLight: '#1f2840',
    peakShadow: '#0a0e1a',
    haze: '#101728',
    flats: '#090b13',
    interiorAmbient: '#1f1509',
    lampIntensity: 1,
    shaftIntensity: 0,
    shaftColor: '#ffd9a0',
    starOpacity: 0.95,
    afterglow: 0.04,
    windowBloom: 0.08,
  },
  // Wraps back round to midnight.
  { at: 24, ...NIGHT },
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function mixColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function mixNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Smoothstep, so transitions ease rather than corner. */
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}


/**
 * Anchoring the model day to the real one.
 *
 * The keyframes above are a "mountain summer" day: first light at 4:30, the
 * Grand burning at 5:54, the sun gone at 20:24. Those were reasonable guesses
 * and two of them were half an hour out.
 *
 * Rather than rewrite the palette against live data — which would mean
 * refitting every colour every time the season moved — the clock itself is
 * warped. Real local time is remapped piecewise-linearly onto model time using
 * the solar events as anchor points, so alpenglow always lands on the real
 * sunrise and the shaft across the floor always lands on the real golden hour.
 *
 * The pleasant consequence is that the day breathes with the year for free. In
 * late August the barn gets a fourteen-hour day; in December the same palette
 * compresses into nine, with a long blue morning and an afternoon that is over
 * before it starts.
 */
export type SolarAnchors = {
  firstLight: number
  sunrise: number
  solarNoon: number
  goldenHour: number
  sunset: number
  dusk: number
  lastLight: number
}

/** Where each solar event sits in the keyframe table above. */
const MODEL_DAY: SolarAnchors = {
  firstLight: 4.5,
  sunrise: 5.9,
  solarNoon: 13,
  goldenHour: 19.7,
  sunset: 20.4,
  dusk: 21.3,
  lastLight: 22.6,
}

const MODEL_POINTS = [
  0,
  MODEL_DAY.firstLight,
  MODEL_DAY.sunrise,
  MODEL_DAY.solarNoon,
  MODEL_DAY.goldenHour,
  MODEL_DAY.sunset,
  MODEL_DAY.dusk,
  MODEL_DAY.lastLight,
  24,
]

/**
 * Real local hour -> model hour. Falls straight through to identity if the
 * anchors are missing or not strictly increasing, which they will not be
 * inside the Arctic Circle or if the API returns something odd. Near Coffee is
 * at 43°N, but a scene that breaks on bad input is a scene that breaks.
 */
export function solarRemap(hour: number, solar?: SolarAnchors | null): number {
  if (!solar) return hour
  const real = [
    0,
    solar.firstLight,
    solar.sunrise,
    solar.solarNoon,
    solar.goldenHour,
    solar.sunset,
    solar.dusk,
    solar.lastLight,
    24,
  ]
  for (let i = 1; i < real.length; i++) {
    if (!(real[i] > real[i - 1])) return hour
  }
  for (let i = 0; i < real.length - 1; i++) {
    if (hour >= real[i] && hour <= real[i + 1]) {
      const t = (hour - real[i]) / (real[i + 1] - real[i])
      return MODEL_POINTS[i] + t * (MODEL_POINTS[i + 1] - MODEL_POINTS[i])
    }
  }
  return hour
}

/**
 * Resolve the light for a given hour of the day (0..24, fractional).
 */
export function daylightAt(hour: number, solar?: SolarAnchors | null): Daylight {
  const h = solarRemap(((hour % 24) + 24) % 24, solar)

  let lo = KEYFRAMES[0]
  let hi = KEYFRAMES[KEYFRAMES.length - 1]
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].at && h <= KEYFRAMES[i + 1].at) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }

  const span = hi.at - lo.at
  const t = span === 0 ? 0 : ease((h - lo.at) / span)

  return {
    skyTop: mixColor(lo.skyTop, hi.skyTop, t),
    skyMid: mixColor(lo.skyMid, hi.skyMid, t),
    skyHorizon: mixColor(lo.skyHorizon, hi.skyHorizon, t),
    peakLight: mixColor(lo.peakLight, hi.peakLight, t),
    peakShadow: mixColor(lo.peakShadow, hi.peakShadow, t),
    haze: mixColor(lo.haze, hi.haze, t),
    flats: mixColor(lo.flats, hi.flats, t),
    interiorAmbient: mixColor(lo.interiorAmbient, hi.interiorAmbient, t),
    shaftColor: mixColor(lo.shaftColor, hi.shaftColor, t),
    lampIntensity: mixNumber(lo.lampIntensity, hi.lampIntensity, t),
    shaftIntensity: mixNumber(lo.shaftIntensity, hi.shaftIntensity, t),
    starOpacity: mixNumber(lo.starOpacity, hi.starOpacity, t),
    afterglow: mixNumber(lo.afterglow, hi.afterglow, t),
    windowBloom: mixNumber(lo.windowBloom, hi.windowBloom, t),
    label: t < 0.5 ? lo.label : hi.label,
  }
}

/** The visitor's own local time, as a fractional hour. */
export function localHour(now = new Date()): number {
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
}

export { mixColor }
