/**
 * Wyoming, right now.
 *
 * Two keyless public APIs, both verified to send CORS headers for
 * https://www.nearcoffee.space:
 *
 *   sunrisesunset.io  — solar and lunar times for the barn's coordinates
 *   open-meteo.com    — current conditions at the barn
 *
 * Everything here degrades to null on failure and the scene falls back to its
 * built-in "mountain summer" model. A coffee shop that goes dark because a
 * weather API had a bad afternoon would be a poor coffee shop.
 */

/**
 * Mormon Row, Antelope Flats — the homestead barns inside Grand Teton
 * National Park. sunrisesunset.io independently reports the elevation here as
 * 2010m, which is right for the valley floor, so the coordinates are good.
 */
export const BARN_LAT = 43.6516
export const BARN_LON = -110.6614
export const BARN_TZ = 'America/Denver'

export type Solar = {
  /** All fractional local hours, 0–24. */
  firstLight: number
  sunrise: number
  solarNoon: number
  goldenHour: number
  sunset: number
  dusk: number
  lastLight: number
  /** Compass bearings in degrees, 0 = north, 90 = east. */
  sunriseAzimuth: number
  sunsetAzimuth: number
  /** Sun altitude at solar noon, degrees. ~58° midsummer here, ~23° midwinter. */
  noonAltitude: number
  /** 0–1. */
  moonIllumination: number
  moonPhase: string
}

export type Weather = {
  temperatureC: number
  /** 0–1. */
  cloudCover: number
  /** cm in the last interval. */
  snowfallCm: number
  windKph: number
  /** WMO code. */
  code: number
  label: string
}

export type Place = {
  solar: Solar | null
  weather: Weather | null
}

/** "8:23:50 PM" -> 20.397 */
function clockToHour(s: string | null | undefined): number | null {
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i.exec(s.trim())
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2])
  const sec = Number(m[3])
  const mer = m[4]?.toUpperCase()
  if (mer === 'PM' && h !== 12) h += 12
  if (mer === 'AM' && h === 12) h = 0
  return h + min / 60 + sec / 3600
}

/** WMO 4677, abridged to what actually happens in Jackson Hole. */
const WMO: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  56: 'freezing drizzle',
  57: 'freezing drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'rain showers',
  81: 'rain showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm, hail',
  99: 'thunderstorm, hail',
}

type Cached<T> = { at: number; key: string; value: T }

function readCache<T>(slot: string, key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(slot)
    if (!raw) return null
    const c = JSON.parse(raw) as Cached<T>
    if (c.key !== key) return null
    if (Date.now() - c.at > maxAgeMs) return null
    return c.value
  } catch {
    return null
  }
}

function writeCache<T>(slot: string, key: string, value: T) {
  try {
    localStorage.setItem(slot, JSON.stringify({ at: Date.now(), key, value } satisfies Cached<T>))
  } catch {
    /* private browsing, quota, whatever — the cache is an optimisation */
  }
}

async function fetchSolar(): Promise<Solar | null> {
  const today = new Date().toISOString().slice(0, 10)
  const cached = readCache<Solar>('nc.solar', today, 20 * 60 * 60 * 1000)
  if (cached) return cached

  try {
    const url =
      `https://api.sunrisesunset.io/json?lat=${BARN_LAT}&lng=${BARN_LON}&timezone=${BARN_TZ}`
    const res = await fetch(url)
    if (!res.ok) return null
    const r = (await res.json())?.results
    if (!r) return null

    const solar: Solar = {
      firstLight: clockToHour(r.first_light) ?? 4.5,
      sunrise: clockToHour(r.sunrise) ?? 5.9,
      solarNoon: clockToHour(r.solar_noon) ?? 13,
      goldenHour: clockToHour(r.golden_hour) ?? 19.7,
      sunset: clockToHour(r.sunset) ?? 20.4,
      dusk: clockToHour(r.dusk) ?? 21.3,
      lastLight: clockToHour(r.last_light) ?? 22.6,
      sunriseAzimuth: Number(r.sunrise_azimuth) || 90,
      sunsetAzimuth: Number(r.sunset_azimuth) || 270,
      noonAltitude: Number(r.sun_altitude) || 60,
      moonIllumination: (Number(r.moon_illumination) || 0) / 100,
      moonPhase: String(r.moon_phase ?? ''),
    }
    writeCache('nc.solar', today, solar)
    return solar
  } catch {
    return null
  }
}

async function fetchWeather(): Promise<Weather | null> {
  const slotKey = `${BARN_LAT},${BARN_LON}`
  const cached = readCache<Weather>('nc.weather', slotKey, 15 * 60 * 1000)
  if (cached) return cached

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${BARN_LAT}&longitude=${BARN_LON}` +
      `&current=temperature_2m,cloud_cover,snowfall,wind_speed_10m,weather_code` +
      `&timezone=${BARN_TZ}&forecast_days=1`
    const res = await fetch(url)
    if (!res.ok) return null
    const c = (await res.json())?.current
    if (!c) return null

    const code = Number(c.weather_code) || 0
    const weather: Weather = {
      temperatureC: Number(c.temperature_2m),
      cloudCover: Math.min(1, Math.max(0, Number(c.cloud_cover) / 100)),
      snowfallCm: Number(c.snowfall) || 0,
      windKph: Number(c.wind_speed_10m) || 0,
      code,
      label: WMO[code] ?? 'weather',
    }
    writeCache('nc.weather', slotKey, weather)
    return weather
  } catch {
    return null
  }
}

export async function fetchPlace(): Promise<Place> {
  const [solar, weather] = await Promise.all([fetchSolar(), fetchWeather()])
  return { solar, weather }
}
