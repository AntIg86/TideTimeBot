/** All timestamps are epoch milliseconds; local dates are derived via the IANA timezone. */

export type TideType = 'high' | 'low';
export type TideTrend = 'rising' | 'falling';

export interface TideEvent {
  time: number;
  type: TideType;
  /** Sea level relative to mean sea level, metres. */
  height: number;
}

export interface SeaLevelSeries {
  /** Evenly spaced sample times (hourly from Open-Meteo). */
  times: number[];
  heights: (number | null)[];
}

export interface DailyConditions {
  /** Local midnight of the day. */
  time: number;
  waveMax: number | null;
  windMax: number | null;
  sunrise: number | null;
  sunset: number | null;
}

export interface DayTides {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  events: TideEvent[];
}

export interface TideForecast {
  timezone: string;
  trend: TideTrend | null;
  next: TideEvent | null;
  today: DayTides & { conditions: DailyConditions | null };
  upcoming: DayTides[];
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

/** Local calendar date (YYYY-MM-DD) of a timestamp in the given timezone. */
export function dayKey(time: number, timeZone: string): string {
  let formatter = dayKeyFormatters.get(timeZone);
  if (!formatter) {
    // en-CA formats dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayKeyFormatters.set(timeZone, formatter);
  }
  return formatter.format(time);
}

/** Calendar arithmetic on YYYY-MM-DD keys (independent of DST). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Fits a parabola through three equally spaced samples (x = -1, 0, 1).
 * @returns vertex offset from the middle sample (in steps) and the vertex value
 */
function fitParabola(y1: number, y2: number, y3: number): { offset: number; value: number } {
  const a = (y1 + y3) / 2 - y2;
  const b = (y3 - y1) / 2;
  if (Math.abs(a) < 1e-10) return { offset: 0, value: y2 };
  return { offset: -b / (2 * a), value: y2 - (b * b) / (4 * a) };
}

/** Finds high and low tides as local extrema of the sea level, refined by quadratic interpolation. */
export function findTideExtremes({ times, heights }: SeaLevelSeries): TideEvent[] {
  const events: TideEvent[] = [];

  for (let i = 1; i < heights.length - 1; i++) {
    const prev = heights[i - 1];
    const curr = heights[i];
    const next = heights[i + 1];
    if (prev === null || curr === null || next === null) continue;

    let type: TideType | null = null;
    if (curr > prev && curr >= next) type = 'high';
    else if (curr < prev && curr <= next) type = 'low';
    if (!type) continue;

    const step = times[i + 1] - times[i];
    const { offset, value } = fitParabola(prev, curr, next);
    events.push({ time: Math.round(times[i] + offset * step), type, height: value });
  }

  return events;
}

export function buildForecast(input: {
  seaLevel: SeaLevelSeries;
  daily: DailyConditions[];
  timezone: string;
  now: number;
  days: number;
}): TideForecast {
  const { timezone, now } = input;
  const events = findTideExtremes(input.seaLevel);

  const byDay = new Map<string, TideEvent[]>();
  for (const event of events) {
    const key = dayKey(event.time, timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  const tidesOn = (date: string): DayTides => ({ date, events: byDay.get(date) ?? [] });

  const today = dayKey(now, timezone);
  const conditions = input.daily.find((day) => dayKey(day.time, timezone) === today) ?? null;

  const next = events.find((event) => event.time > now) ?? null;
  const last = events.filter((event) => event.time <= now).at(-1);
  let trend: TideTrend | null = null;
  if (next) trend = next.type === 'high' ? 'rising' : 'falling';
  else if (last) trend = last.type === 'high' ? 'falling' : 'rising';

  return {
    timezone,
    trend,
    next,
    today: { ...tidesOn(today), conditions },
    upcoming: Array.from({ length: input.days }, (_, i) => tidesOn(addDays(today, i + 1))),
  };
}
