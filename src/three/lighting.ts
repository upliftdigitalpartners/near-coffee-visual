import * as THREE from 'three'
import type { Daylight } from '../scene/daylight'

/**
 * Translates the 2D daylight palette into a physical lighting setup.
 *
 * The palette from src/scene/daylight.ts survived the move to 3D intact — it
 * already encodes the thing that matters, which is that this building faces
 * west at the Teton range. Here it becomes a sun with a real position, so the
 * gaps between the siding boards throw genuine stripes across the floor and
 * they swing round through the day on their own.
 */

const SUNRISE = 5.9
const SUNSET = 20.4
const MAX_ELEVATION = THREE.MathUtils.degToRad(62)

export type SceneLight = {
  /** Where the sun is, far enough out to read as parallel light. */
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
}

export function sceneLight(hour: number, light: Daylight): SceneLight {
  const t = (hour - SUNRISE) / (SUNSET - SUNRISE)
  const sunUp = t > 0 && t < 1

  /*
   * Sun track: rises in the east (+Z, behind the barn), passes through the
   * south (-X), sets in the west (-Z) straight down the open door. That last
   * part is why the evening light in here is what it is.
   */
  const phi = THREE.MathUtils.clamp(t, 0, 1) * Math.PI
  const elevation = Math.sin(THREE.MathUtils.clamp(t, 0, 1) * Math.PI) * MAX_ELEVATION
  const horiz = Math.cos(elevation)
  const dir = new THREE.Vector3(-Math.sin(phi) * horiz, Math.sin(elevation), Math.cos(phi) * horiz)

  // Below the horizon the moon takes over from roughly the same quarter.
  const sunPosition = sunUp
    ? dir.multiplyScalar(90)
    : new THREE.Vector3(-30, 46, -70)

  const dayness = sunUp ? Math.sin(THREE.MathUtils.clamp(t, 0, 1) * Math.PI) : 0
  // Low sun is dimmer but far warmer; this is what makes golden hour land.
  const lowSun = sunUp ? Math.pow(1 - dayness, 1.7) : 0

  const sunColor = new THREE.Color(light.shaftColor).lerp(
    new THREE.Color('#fff6e4'),
    1 - lowSun,
  )

  const sunIntensity = sunUp ? 0.5 + dayness * 3.4 : 0.16

  const ambientColor = new THREE.Color(light.skyMid)
  const ambientIntensity = sunUp ? 0.35 + dayness * 0.55 : 0.12

  const bounceColor = new THREE.Color(light.flats).lerp(new THREE.Color(light.skyHorizon), 0.5)
  const bounceIntensity = sunUp ? 0.25 + dayness * 0.5 : 0.06

  const fogColor = new THREE.Color(light.haze)
  const backdropTint = new THREE.Color(light.peakLight)
    .lerp(new THREE.Color('#ffffff'), 0.55)
    .multiplyScalar(sunUp ? 0.55 + dayness * 0.65 : 0.16)

  return {
    sunPosition,
    sunColor,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    bounceColor,
    bounceIntensity,
    fogColor,
    fogDensity: 0.0032,
    backdropTint,
    lampColor: new THREE.Color('#ffb257'),
    lampIntensity: light.lampIntensity,
    sunUp,
  }
}
