import { describe, expect, it } from 'vitest';
import { addDays, buildForecast, dayKey, findTideExtremes, type SeaLevelSeries } from '../src/domain/tides';

const HOUR = 3600_000;
const PERIOD = 12.42 * HOUR; // principal lunar semi-diurnal (M2)
const AMPLITUDE = 1.5;

/** Hourly cosine tide with a high water at `firstHigh`, rounded to centimetres like the API. */
function syntheticTide(start: number, hours: number, firstHigh: number): SeaLevelSeries {
  const times = Array.from({ length: hours }, (_, i) => start + i * HOUR);
  const heights = times.map((time) => Math.round(AMPLITUDE * Math.cos((2 * Math.PI * (time - firstHigh)) / PERIOD) * 100) / 100);
  return { times, heights };
}

describe('findTideExtremes', () => {
  const start = Date.UTC(2026, 9, 3, 0, 0);
  const firstHigh = start + 5.3 * HOUR;
  const events = findTideExtremes(syntheticTide(start, 48, firstHigh));

  it('alternates high and low tides', () => {
    expect(events.length).toBeGreaterThanOrEqual(7);
    events.forEach((event, i) => {
      if (i > 0) expect(event.type).not.toBe(events[i - 1].type);
    });
  });

  it('interpolates times between hourly samples within 10 minutes', () => {
    for (const event of events) {
      const phase = (event.time - firstHigh) / (PERIOD / 2);
      const expected = firstHigh + Math.round(phase) * (PERIOD / 2);
      expect(Math.abs(event.time - expected)).toBeLessThan(10 * 60_000);
      expect(event.type).toBe(Math.round(phase) % 2 === 0 ? 'high' : 'low');
    }
  });

  it('interpolates heights close to the amplitude', () => {
    for (const event of events) {
      expect(Math.abs(event.height)).toBeCloseTo(AMPLITUDE, 1);
      expect(Math.sign(event.height)).toBe(event.type === 'high' ? 1 : -1);
    }
  });

  it('skips extrema next to missing samples', () => {
    const series = syntheticTide(start, 48, firstHigh);
    const heights = series.heights.map((height, i) => (i < 12 ? null : height));
    const result = findTideExtremes({ times: series.times, heights });
    expect(result.every((event) => event.time > series.times[12])).toBe(true);
  });

  it('ignores centimetre wiggles below the minimum swing', () => {
    const times = Array.from({ length: 12 }, (_, i) => i * HOUR);
    const heights = [-0.6, -0.59, -0.6, -0.61, -0.6, -0.59, -0.6, -0.6, -0.61, -0.6, -0.59, -0.6];
    expect(findTideExtremes({ times, heights })).toEqual([]);
  });

  it('keeps a real tide that has small noise on top', () => {
    const series = syntheticTide(start, 48, firstHigh);
    const noisy = series.heights.map((height, i) => height! + (i % 2 ? 0.02 : -0.02));
    const result = findTideExtremes({ times: series.times, heights: noisy });
    expect(result.length).toBe(events.length);
    result.forEach((event, i) => expect(Math.abs(event.time - events[i].time)).toBeLessThan(45 * 60_000));
  });

  it('puts a flat top of three equal samples at its centre', () => {
    const times = Array.from({ length: 7 }, (_, i) => i * HOUR);
    const [high] = findTideExtremes({ times, heights: [0, 0.5, 1, 1, 1, 0.5, 0] });
    expect(high).toEqual({ time: 3 * HOUR, type: 'high', height: 1 });
  });

  it('returns nothing for an all-null series', () => {
    expect(findTideExtremes({ times: [0, HOUR, 2 * HOUR], heights: [null, null, null] })).toEqual([]);
  });
});

describe('dates', () => {
  it('uses the real local offset across the DST change', () => {
    // Lisbon leaves summer time (UTC+1 → UTC+0) on 2026-10-25 at 01:00 UTC.
    expect(dayKey(Date.UTC(2026, 9, 24, 23, 30), 'Europe/Lisbon')).toBe('2026-10-25');
    expect(dayKey(Date.UTC(2026, 9, 25, 23, 30), 'Europe/Lisbon')).toBe('2026-10-25');
  });

  it('adds calendar days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('buildForecast', () => {
  const timezone = 'Europe/Lisbon';
  const start = Date.UTC(2026, 9, 21, 0, 0);
  const seaLevel = syntheticTide(start, 24 * 10, start + 3 * HOUR);
  const now = Date.UTC(2026, 9, 22, 10, 0);
  const daily = [{ date: '2026-10-22', waveMax: 1.2, windMax: 4.5, sunrise: null, sunset: null }];
  const forecast = buildForecast({ seaLevel, daily, timezone, now, days: 7 });

  it('returns today and seven upcoming calendar days through the DST change', () => {
    expect(forecast.today.date).toBe('2026-10-22');
    expect(forecast.upcoming.map((day) => day.date)).toEqual([
      '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ]);
  });

  it('puts every event into the day of its local date', () => {
    for (const day of [forecast.today, ...forecast.upcoming]) {
      expect(day.events.length).toBeGreaterThanOrEqual(3);
      for (const event of day.events) expect(dayKey(event.time, timezone)).toBe(day.date);
    }
  });

  it('derives next tide and trend from the first future event', () => {
    expect(forecast.next).not.toBeNull();
    expect(forecast.next!.time).toBeGreaterThan(now);
    expect(forecast.trend).toBe(forecast.next!.type === 'high' ? 'rising' : 'falling');
  });

  it('picks daily conditions for the local today', () => {
    expect(forecast.today.conditions?.waveMax).toBe(1.2);
  });

  it('reports tides for a regular semi-diurnal signal', () => {
    expect(forecast.hasTides).toBe(true);
  });

  it('treats a slow wind-driven drift as no tides', () => {
    // One 20 cm swell over ten days: extremes exist, but far fewer than one a day.
    const drift = {
      times: seaLevel.times,
      heights: seaLevel.times.map((time) => Math.round(0.1 * Math.sin((2 * Math.PI * (time - start)) / (5 * 24 * HOUR)) * 100) / 100),
    };
    const result = buildForecast({ seaLevel: drift, daily, timezone, now, days: 7 });
    expect(result.hasTides).toBe(false);
  });

  it('falls back to the last past event when no future one exists', () => {
    const past = buildForecast({ seaLevel, daily: [], timezone, now: start + 24 * 20 * HOUR, days: 7 });
    expect(past.next).toBeNull();
    expect(past.trend).not.toBeNull();
  });
});
