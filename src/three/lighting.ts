import * as THREE from 'three'
import type { Daylight } from '../scene/daylight'
import type { Solar, Weather } from '../scene/place'

/**
 * Translates the daylight palette into a physical lighting setup, using live
 * solar geometry and current conditions at the barn when they are available.
 *
 * The palette from src/scene/daylight.ts survived the move to 3D intact — it
 * already encodes the thing that matters, which is that this building faces
 * west at the Teton range. Here it becomes a sun with a real position, so the
 * gaps between the siding boards throw genuine stripes across the floor and
 * they swing round through the day on their own.
 */

/** Fallbacks, used until the API answers — or if it never does. */
const FALLBACK_SUNRISE = 5.9
const FALLBACK_SUNSET = 20.4
const FALLBACK_NOON_ALTITUDE = 62
/** Sunrise NE, sunset NW: roughly right for 43°N in summer. */
const FALLBACK_SUNRISE_AZIMUTH = 71
const FALLBACK_SUNSET_AZIMUTH = 289

export type SceneLight = {
  sunPosition: THREE.Vector3
  sunColor: THREE.Color
  sunIntensity: number
  ambientColor: THREE.Color
  ambientIntensity: number
  /** Bounce off the valley floor coming back in through the door. */
  bounceColor: THREE.Color
  bounceIntensity: number
  fogColor: THREE.Color
  fogDensity: number
  /** Multiplied over the Teton photograph. */
  backdropTint: THREE.Color
  lampColor: THREE.Color
  lampIntensity: number
  sunUp: boolean
  /** 0–1, straight from the weather. Drives how hard the shadows are. */
  cloudCover: number
  /** 0–1. Falling snow outside the door. */
  snow: number
  /** How strongly the sky lights the room. Rides the day, or it glows at 2am. */
  envIntensity: number
  /**
   * Colour grade applied to the Teton photograph.
   *
   * The plate is a bright clear midday shot and the room is very often not.
   * Multiplying it by a tint — which is all it used to get — cannot make noon
   * look like dusk: it just makes noon darker, and the mismatch between a
   * crisp blue photograph and a warm dim room reads as fake even when nobody
   * can say why. Exposure, saturation and a push toward the sun's own colour
   * do the job a colourist would.
   */
  backdropGrade: {
    exposure: number
    saturation: number
    tint: THREE.Color
    tintAmount: number
    lift: number
  }
}

/**
 * Compass bearing to a world direction.
 *
 * The barn's door faces west, which in this scene is -Z. So north is +X and
 * east is +Z, and a bearing measured clockwise from north lands as
 * (cos, sin) on (X, Z). Getting this backwards puts the morning sun in the
 * doorway, which looks wrong in a way that is hard to name but easy to feel.
 */
function bearingToDirection(bearingDeg: number, altitudeDeg: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(bearingDeg)
  const e = THREE.MathUtils.degToRad(altitudeDeg)
  const horiz = Math.cos(e)
  return new THREE.Vector3(Math.cos(a) * horiz, Math.sin(e), Math.sin(a) * horiz)
}

export function sceneLight(
  hour: number,
  light: Daylight,
  solar?: Solar | null,
  weather?: Weather | null,
): SceneLight {
  const sunrise = solar?.sunrise ?? FALLBACK_SUNRISE
  const sunset = solar?.sunset ?? FALLBACK_SUNSET
  const noonAltitude = solar?.noonAltitude ?? FALLBACK_NOON_ALTITUDE
  const riseAz = solar?.sunriseAzimuth ?? FALLBACK_SUNRISE_AZIMUTH
  const setAz = solar?.sunsetAzimuth ?? FALLBACK_SUNSET_AZIMUTH

  const span = Math.max(0.5, sunset - sunrise)
  const t = (hour - sunrise) / span
  const sunUp = t > 0 && t < 1
  const day = sunUp ? Math.sin(THREE.MathUtils.clamp(t, 0, 1) * Math.PI) : 0

  /*
   * Azimuth swings from the real sunrise bearing, through due south at solar
   * noon, to the real sunset bearing. Today that is 71° -> 180° -> 288°. In
   * December it narrows to something like 121° -> 239°, and the sun never
   * gets round far enough to reach in through the door at all.
   */
  const azimuth =
    t <= 0.5
      ? THREE.MathUtils.lerp(riseAz, 180, THREE.MathUtils.clamp(t * 2, 0, 1))
      : THREE.MathUtils.lerp(180, setAz, THREE.MathUtils.clamp((t - 0.5) * 2, 0, 1))

  const altitude = day * noonAltitude

  const cloud = weather?.cloudCover ?? 0
  const moon = solar?.moonIllumination ?? 0.5

  const sunPosition = sunUp
    ? bearingToDirection(azimuth, altitude).multiplyScalar(90)
    : // Moonlight, from the opposite quarter and much colder.
      bearingToDirection((azimuth + 180) % 360, 34).multiplyScalar(90)

  // Low sun is dimmer but far warmer; this is what makes golden hour land.
  const lowSun = sunUp ? Math.pow(1 - day, 1.7) : 0
  const sunColor = new THREE.Color(light.shaftColor).lerp(new THREE.Color('#fff6e4'), 1 - lowSun)

  /*
   * Cloud is the single biggest lever in here. Overcast does not just dim the
   * sun, it removes the direction from the light: the stripes through the
   * siding vanish and the whole barn goes flat and even. Turning the
   * directional light down while turning ambient up is exactly that.
   */
  const overcast = Math.pow(cloud, 1.3)
  const sunIntensity = sunUp
    ? (0.5 + day * 3.4) * (1 - 0.78 * overcast)
    : 0.16 * (0.35 + moon * 0.9) * (1 - 0.7 * overcast)

  const ambientColor = new THREE.Color(light.skyMid).lerp(new THREE.Color('#b9c2cc'), overcast * 0.55)
  const ambientIntensity = (sunUp ? 0.35 + day * 0.55 : 0.12 + moon * 0.06) * (1 + 0.85 * overcast)

  const bounceColor = new THREE.Color(light.flats).lerp(new THREE.Color(light.skyHorizon), 0.5)
  const bounceIntensity = (sunUp ? 0.25 + day * 0.5 : 0.06) * (1 - 0.3 * overcast)

  const fogColor = new THREE.Color(light.haze).lerp(new THREE.Color('#9aa3ad'), overcast * 0.5)

  const backdropTint = new THREE.Color(light.peakLight)
    .lerp(new THREE.Color('#ffffff'), 0.55)
    .multiplyScalar(sunUp ? 0.55 + day * 0.65 : 0.16 + moon * 0.1)
    .lerp(new THREE.Color('#8d949c'), overcast * 0.4)

  /*
   * Grading the plate. Night is the big one: a photograph does not just get
   * darker after sunset, it loses nearly all its colour and goes blue, and
   * without that the mountains stay stubbornly sunlit at midnight.
   */
  const gradeTint = sunUp
    ? new THREE.Color(light.shaftColor)
    : new THREE.Color('#4c6a9c')
  const backdropGrade = {
    exposure: sunUp ? (0.35 + day * 0.75) * (1 - 0.25 * overcast) : 0.1 + moon * 0.12,
    saturation: sunUp ? 1 - 0.3 * overcast - 0.15 * lowSun : 0.3,
    tint: gradeTint,
    tintAmount: sunUp ? 0.1 + lowSun * 0.4 : 0.55,
    lift: sunUp ? 0.01 * overcast : 0.012,
  }

  /* Snowfall arrives in cm per interval; anything at all is worth drawing. */
  const snow = THREE.MathUtils.clamp((weather?.snowfallCm ?? 0) / 0.4, 0, 1)

  return {
    sunPosition,
    sunColor,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    bounceColor,
    bounceIntensity,
    fogColor,
    fogDensity: 0.0032 + overcast * 0.004,
    backdropTint,
    lampColor: new THREE.Color('#ffb257'),
    lampIntensity: light.lampIntensity,
    sunUp,
    cloudCover: cloud,
    snow,
    /*
     * Overcast raises this rather than lowering it: on a grey day the sky IS
     * the light source, and the room fills with flat skylight instead of a
     * beam. At night it drops to a trace so the moon and the bulbs carry it.
     */
    envIntensity: sunUp ? (0.28 + day * 0.5) * (1 + 0.35 * overcast) : 0.05 + moon * 0.07,
    backdropGrade,
  }
}
