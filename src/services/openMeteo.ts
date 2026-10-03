import { UserError } from '../errors';
import type { DailyConditions, SeaLevelSeries } from '../domain/tides';
import { fetchJson } from './http';

/** Days of data to request: yesterday + today + 7 upcoming days + 1 spare day for extrema near midnight. */
const PAST_DAYS = 1;
const FORECAST_DAYS = 9;

interface MarineResponse {
  timezone: string;
  hourly: { time: number[]; sea_level_height_msl: (number | null)[] };
  daily?: { time: number[]; wave_height_max?: (number | null)[] };
}

interface WeatherResponse {
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
}

function buildUrl(base: string, lat: number, lon: number, params: Record<string, string | number>): URL {
  const url = new URL(base);
  const query: Record<string, string> = {
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    timeformat: 'unixtime',
  };
  for (const [key, value] of Object.entries(params)) query[key] = String(value);
  url.search = new URLSearchParams(query).toString();
  return url;
}

const toMs = (seconds: number | null | undefined): number | null =>
  seconds == null ? null : seconds * 1000;

export async function fetchForecast(lat: number, lon: number): Promise<RawForecast> {
  const [marine, weather] = await Promise.all([
    fetchJson<MarineResponse>(
      buildUrl('https://marine-api.open-meteo.com/v1/marine', lat, lon, {
        hourly: 'sea_level_height_msl',
        daily: 'wave_height_max',
        past_days: PAST_DAYS,
        forecast_days: FORECAST_DAYS,
      }),
    ),
    fetchJson<WeatherResponse>(
      buildUrl('https://api.open-meteo.com/v1/forecast', lat, lon, {
        daily: 'wind_speed_10m_max,sunrise,sunset',
        wind_speed_unit: 'ms',
        forecast_days: 1,
      }),
    ),
  ]);

  const heights = marine.hourly.sea_level_height_msl;
  if (!heights.some((height) => height !== null)) {
    throw new UserError('noTideData');
  }

  // Both APIs use the same local-midnight timestamps for daily rows, so merge by time.
  const daily = new Map<number, DailyConditions>();
  const row = (time: number): DailyConditions => {
    let entry = daily.get(time);
    if (!entry) {
      entry = { time: time * 1000, waveMax: null, windMax: null, sunrise: null, sunset: null };
      daily.set(time, entry);
    }
    return entry;
  };

  marine.daily?.time.forEach((time, i) => {
    row(time).waveMax = marine.daily?.wave_height_max?.[i] ?? null;
  });
  weather.daily?.time.forEach((time, i) => {
    const entry = row(time);
    entry.windMax = weather.daily?.wind_speed_10m_max?.[i] ?? null;
    entry.sunrise = toMs(weather.daily?.sunrise?.[i]);
    entry.sunset = toMs(weather.daily?.sunset?.[i]);
  });

  return {
    timezone: marine.timezone,
    seaLevel: { times: marine.hourly.time.map((time) => time * 1000), heights },
    daily: [...daily.values()],
  };
}
