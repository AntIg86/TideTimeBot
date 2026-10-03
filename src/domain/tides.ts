/** All timestamps are epoch milliseconds; local dates are derived via the IANA timezone. */

const DAY_MS = 24 * 3600_000;

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
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
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
  /** False for nearly tideless seas, where the level only drifts with wind and pressure. */
  hasTides: boolean;
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

/**
 * Minimum rise or fall (metres) that confirms a high or low. Filters centimetre rounding
 * noise, and leaves nearly tideless seas (Black Sea, Baltic) without events.
 */
const MIN_TIDE_SWING = 0.1;

/**
 * Refines a sampled extremum: the vertex of a parabola through it and its neighbours,
 * or the centre of a flat top of three or more equal samples.
 */
function refineExtremum({ times, heights }: SeaLevelSeries, i: number, type: TideType): TideEvent {
  const value = heights[i]!;
  let end = i;
  while (heights[end + 1] === value) end++;
  if (end > i + 1) {
    return { time: Math.round((times[i] + times[end]) / 2), type, height: value };
  }

  const prev = heights[i - 1]!;
  const next = heights[i + 1]!;
  const { offset, value: vertex } = fitParabola(prev, value, next);
  return { time: Math.round(times[i] + offset * (times[i + 1] - times[i])), type, height: vertex };
}

/**
 * Finds high and low tides with a zigzag filter: an extremum counts only once the sea level
 * has moved away from it by at least MIN_TIDE_SWING. Times and heights are then refined.
 */
export function findTideExtremes(series: SeaLevelSeries, minSwing = MIN_TIDE_SWING): TideEvent[] {
  const { heights } = series;
  const events: TideEvent[] = [];
  let direction: 'up' | 'down' | null = null;
  let highIdx = -1;
  let lowIdx = -1;

  const confirm = (i: number, type: TideType) => {
    // An extremum next to the edge of the data (or a gap) is just where the series starts or ends.
    if (heights[i - 1] != null && heights[i + 1] != null) events.push(refineExtremum(series, i, type));
  };

  for (let i = 0; i < heights.length; i++) {
    const height = heights[i];
    if (height === null) continue;
    if (highIdx < 0 || height > heights[highIdx]!) highIdx = i;
    if (lowIdx < 0 || height < heights[lowIdx]!) lowIdx = i;

    if (direction !== 'down' && heights[highIdx]! - height >= minSwing) {
      confirm(highIdx, 'high');
      direction = 'down';
      lowIdx = i;
    } else if (direction !== 'up' && height - heights[lowIdx]! >= minSwing) {
      confirm(lowIdx, 'low');
      direction = 'up';
      highIdx = i;
    }
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
  const conditions = input.daily.find((day) => day.date === today) ?? null;

  const next = events.find((event) => event.time > now) ?? null;
  const last = events.filter((event) => event.time <= now).at(-1);
  let trend: TideTrend | null = null;
  if (next) trend = next.type === 'high' ? 'rising' : 'falling';
  else if (last) trend = last.type === 'high' ? 'falling' : 'rising';

  // Real tides give at least one high or low a day (usually four); wind-driven drift in
  // nearly tideless seas (Black Sea, Baltic) gives a few extremes per week.
  const { times } = input.seaLevel;
  const spanDays = times.length > 1 ? (times[times.length - 1] - times[0]) / DAY_MS : 0;
  const hasTides = events.length > 0 && events.length >= spanDays;

  return {
    timezone,
    hasTides,
    trend,
    next,
    today: { ...tidesOn(today), conditions },
    upcoming: Array.from({ length: input.days }, (_, i) => tidesOn(addDays(today, i + 1))),
  };
}
