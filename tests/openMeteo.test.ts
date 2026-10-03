import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchForecast } from '../src/services/openMeteo';

const hourly = (heights: (number | null)[]) => ({ time: heights.map((_, i) => i * 3600), sea_level_height_msl: heights });
const marine = (latitude: number, longitude: number, heights: (number | null)[]) => ({
  latitude,
  longitude,
  timezone: 'Europe/Moscow',
  hourly: hourly(heights),
  daily: { time: [0], wave_height_max: [1.1] },
});
const weather = { daily: { time: [0], wind_speed_10m_max: [5], sunrise: [100], sunset: [200] } };

function stubApis(handlers: { marine: (url: URL) => unknown }) {
  const fetchMock = vi.fn(async (input: URL | string) => {
    const url = new URL(input);
    const body = url.host.startsWith('marine') ? handlers.marine(url) : weather;
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchForecast', () => {
  it('uses the place itself when it has sea-level data', async () => {
    const fetchMock = stubApis({ marine: () => marine(43.6, 39.7, [0.1, 0.3, 0.2]) });
    const forecast = await fetchForecast(43.6, 39.7);
    expect(forecast.seaPoint).toBeNull();
    expect(forecast.seaLevel.heights).toEqual([0.1, 0.3, 0.2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the nearest probed sea cell', async () => {
    stubApis({
      marine: (url) => {
        if (url.searchParams.get('latitude')!.includes(',')) {
          // Probe: only two cells have data; the closer one must win.
          const count = url.searchParams.get('latitude')!.split(',').length;
          return Array.from({ length: count }, (_, i) => {
            if (i === 3) return marine(69.458, 33.458, [0.5]);
            if (i === 10) return marine(69.9, 34.5, [0.5]);
            return marine(68.9 + i * 0.01, 33, [null]);
          });
        }
        if (url.searchParams.get('latitude') === '69.4580') return marine(69.458, 33.458, [0.4, 0.6, 0.5]);
        return marine(68.958, 33.042, [null, null, null]);
      },
    });

    const forecast = await fetchForecast(68.9707, 33.0749);
    expect(forecast.seaPoint).toMatchObject({ lat: 69.458, lon: 33.458 });
    expect(forecast.seaPoint!.distanceKm).toBeCloseTo(56, 0);
    expect(forecast.seaLevel.heights).toEqual([0.4, 0.6, 0.5]);
  });

  it('reports noTideData when no sea is nearby', async () => {
    stubApis({
      marine: (url) => {
        const count = url.searchParams.get('latitude')!.split(',').length;
        const empty = marine(48.7, 44.5, [null]);
        return count > 1 ? Array.from({ length: count }, () => empty) : empty;
      },
    });
    await expect(fetchForecast(48.7, 44.5)).rejects.toMatchObject({ key: 'noTideData' });
  });
});
