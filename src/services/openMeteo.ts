import { UserError } from '../errors';
import { distanceKm, ringPoints, type Point } from '../domain/geo';
import { dayKey, type DailyConditions, type SeaLevelSeries } from '../domain/tides';
import { fetchJson } from './http';

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

/** Days of data to request: yesterday + today + 7 upcoming days + 1 spare day for extrema near midnight. */
const PAST_DAYS = 1;
const FORECAST_DAYS = 9;

/**
 * Where to look for sea-level data when the place itself has none (bays, fjords, river mouths).
 * Ring spacing stays under ~25 km so narrow stretches of sea are not skipped.
 */
const SEARCH_RINGS = [
  { km: 20, count: 8 },
  { km: 40, count: 12 },
  { km: 60, count: 16 },
];

interface MarineResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current?: { sea_surface_temperature?: number | null };
  hourly: { time: number[]; sea_level_height_msl: (number | null)[] };
  daily?: { time: number[]; wave_height_max?: (number | null)[] };
}

interface WeatherResponse {
  timezone: string;
  daily?: {
    time: number[];
    wind_speed_10m_max?: (number | null)[];
    sunrise?: (number | null)[];
    sunset?: (number | null)[];
  };
}

export interface RawForecast {
  timezone: string;
  seaLevel: SeaLevelSeries;
  daily: DailyConditions[];
  /** Current sea surface temperature, °C. */
  waterTemperature: number | null;
  /** Set when tides come from a nearby sea point because the place itself has no data. */
  seaPoint: (Point & { distanceKm: number }) | null;
}

function buildUrl(base: string, points: Point[], params: Record<string, string | number>): URL {
  const url = new URL(base);
  const query: Record<string, string> = {
    // Open-Meteo accepts comma-separated coordinates and then answers with an array.
    latitude: points.map((p) => p.lat.toFixed(4)).join(','),
    longitude: points.map((p) => p.lon.toFixed(4)).join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
  };
  for (const [key, value] of Object.entries(params)) query[key] = String(value);
  url.search = new URLSearchParams(query).toString();
  return url;
}

const hasSeaLevel = (marine: MarineResponse) => marine.hourly.sea_level_height_msl.some((height) => height !== null);

const toMs = (seconds: number | null | undefined): number | null =>
  seconds == null ? null : seconds * 1000;

function fetchMarine(point: Point): Promise<MarineResponse> {
  return fetchJson<MarineResponse>(
    buildUrl(MARINE_URL, [point], {
      current: 'sea_surface_temperature',
      hourly: 'sea_level_height_msl',
      daily: 'wave_height_max',
      past_days: PAST_DAYS,
      forecast_days: FORECAST_DAYS,
    }),
  );
}

/** Nearest model cell with sea-level data within the search rings, or null. */
async function findNearestSeaPoint(origin: Point): Promise<(Point & { distanceKm: number }) | null> {
  const probes = await fetchJson<MarineResponse[]>(
    buildUrl(MARINE_URL, ringPoints(origin, SEARCH_RINGS), { hourly: 'sea_level_height_msl', forecast_days: 1 }),
  );

  let best: (Point & { distanceKm: number }) | null = null;
  for (const probe of probes) {
    if (!hasSeaLevel(probe)) continue;
    const cell = { lat: probe.latitude, lon: probe.longitude };
    const distance = distanceKm(origin, cell);
    if (!best || distance < best.distanceKm) best = { ...cell, distanceKm: distance };
  }
  return best;
}

async function fetchTides(origin: Point): Promise<{ marine: MarineResponse; seaPoint: RawForecast['seaPoint'] }> {
  const marine = await fetchMarine(origin);
  if (hasSeaLevel(marine)) return { marine, seaPoint: null };

  const seaPoint = await findNearestSeaPoint(origin);
  if (!seaPoint) throw new UserError('noTideData');
  return { marine: await fetchMarine(seaPoint), seaPoint };
}

export async function fetchForecast(lat: number, lon: number): Promise<RawForecast> {
  const origin = { lat, lon };
  const [{ marine, seaPoint }, weather] = await Promise.all([
    fetchTides(origin),
    fetchJson<WeatherResponse>(
      buildUrl(WEATHER_URL, [origin], {
        daily: 'wind_speed_10m_max,sunrise,sunset',
        wind_speed_unit: 'ms',
        forecast_days: 1,
      }),
    ),
  ]);

  // Merge daily rows by local calendar date. Each API resolves `timezone=auto` for its own
  // grid cell, so near a timezone border their midnight timestamps can differ.
  const daily = new Map<string, DailyConditions>();
  const row = (seconds: number, timezone: string): DailyConditions => {
    const date = dayKey(seconds * 1000, timezone);
    let entry = daily.get(date);
    if (!entry) {
      entry = { date, waveMax: null, windMax: null, sunrise: null, sunset: null };
      daily.set(date, entry);
    }
    return entry;
  };

  marine.daily?.time.forEach((time, i) => {
    row(time, marine.timezone).waveMax = marine.daily?.wave_height_max?.[i] ?? null;
  });
  weather.daily?.time.forEach((time, i) => {
    const entry = row(time, weather.timezone);
    entry.windMax = weather.daily?.wind_speed_10m_max?.[i] ?? null;
    entry.sunrise = toMs(weather.daily?.sunrise?.[i]);
    entry.sunset = toMs(weather.daily?.sunset?.[i]);
  });

  return {
    timezone: marine.timezone,
    seaLevel: { times: marine.hourly.time.map((time) => time * 1000), heights: marine.hourly.sea_level_height_msl },
    daily: [...daily.values()],
    waterTemperature: marine.current?.sea_surface_temperature ?? null,
    seaPoint,
  };
}
