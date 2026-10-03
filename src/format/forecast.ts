import { dayKey, type TideEvent, type TideForecast, type TideType } from '../domain/tides';
import { t, type MessageKey } from '../messages';

const LOCALE = 'en';

const TIDE_ICON: Record<TideType, string> = { high: '🌊', low: '🏖️' };
const DIVIDER = '──────────────────';

export interface PlaceLabel {
  name: string;
  /** Distance to the sea point the tides come from, when it is not the place itself. */
  seaPointKm?: number;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Intl formatters are expensive to build; reuse them per options. */
const formatters = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function memo<T extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, create: () => T): T {
  let formatter = formatters.get(key) as T | undefined;
  if (!formatter) {
    formatter = create();
    formatters.set(key, formatter);
  }
  return formatter;
}

function formatTime(time: number, timeZone: string): string {
  return memo(`time|${timeZone}`, () =>
    new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  ).format(time);
}

/** Formats a YYYY-MM-DD key; noon UTC keeps the calendar date stable in any formatter. */
function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return memo(`date|${JSON.stringify(options)}`, () =>
    new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }),
  ).format(new Date(`${date}T12:00:00Z`));
}

function formatNumber(value: number): string {
  return memo('number', () =>
    new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  ).format(value);
}

function formatHeight(height: number): string {
  const rounded = Math.round(height * 10) / 10;
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${formatNumber(Math.abs(rounded))} ${t('meters')}`;
}

export function renderForecast(forecast: TideForecast, place: PlaceLabel): string {
  const { timezone: tz, today } = forecast;
  const time = (value: number) => formatTime(value, tz);
  const label = (key: MessageKey) => `<b>${t(key)}:</b>`;
  const lines: string[] = [];

  // Header
  lines.push(`🌊 <b>${t('title')}</b>`, `📍 <b>${escapeHtml(place.name)}</b>`);
  if (place.seaPointKm !== undefined) {
    lines.push(`<i>🧭 ${t('seaPoint', { km: Math.round(place.seaPointKm) })}</i>`);
  }
  lines.push(DIVIDER);

  // Right now
  if (!forecast.hasTides) {
    lines.push(`〰️ ${t('negligibleTides')}`);
  } else {
    const trendIcon = forecast.trend === 'falling' ? '📉' : '📈';
    lines.push(`${trendIcon} ${label('now')} ${t(forecast.trend ?? 'unknown')}`);
    if (forecast.next) {
      const { next } = forecast;
      const nextDay = dayKey(next.time, tz);
      const dayNote = nextDay === today.date ? '' : ` (${formatDate(nextDay, { weekday: 'short' })})`;
      lines.push(`🔜 ${label('next')} ${TIDE_ICON[next.type]} ${t(next.type)} ${t('at')} <b>${time(next.time)}</b>${dayNote}`);
    }
  }

  // Today's conditions
  const details: string[] = [];
  if (forecast.waterTemperature !== null) {
    details.push(`🌡️ ${label('water')} ${t('degrees', { value: formatNumber(forecast.waterTemperature) })}`);
  }
  const conditions = today.conditions;
  if (conditions) {
    // ~0 m waves usually means a sheltered bay or river the wave model does not cover.
    if (conditions.waveMax !== null && conditions.waveMax >= 0.05) {
      details.push(`🏄 ${label('waves')} ${t('upToMeters', { value: formatNumber(conditions.waveMax) })}`);
    }
    if (conditions.windMax !== null) {
      details.push(`💨 ${label('wind')} ${t('upToSpeed', { value: formatNumber(conditions.windMax) })}`);
    }
    if (conditions.sunrise !== null && conditions.sunset !== null) {
      details.push(`☀️ ${label('sun')} 🌅 ${time(conditions.sunrise)} · 🌇 ${time(conditions.sunset)}`);
    }
  }
  if (details.length) lines.push('', ...details);
  lines.push(DIVIDER);

  if (forecast.hasTides) lines.push(...renderSchedule(forecast, time));
  lines.push(`🌍 <i>${escapeHtml(tz)}</i>`);
  return lines.join('\n');
}

function renderSchedule(forecast: TideForecast, time: (value: number) => string): string[] {
  const { today } = forecast;
  const lines: string[] = [];

  // Today's tides
  const todayLabel = formatDate(today.date, { weekday: 'short', day: 'numeric', month: 'short' });
  lines.push(`📅 <b>${t('today')}, ${todayLabel}</b>`);
  const todayRows = today.events.map(
    (event) =>
      `• <b>${time(event.time)}</b>  ${TIDE_ICON[event.type]} ${t(event.type)} · <i>${formatHeight(event.height)}</i>`,
  );
  lines.push(`<blockquote>${todayRows.length ? todayRows.join('\n') : `<i>${t('noTides')}</i>`}</blockquote>`);

  // Upcoming days, collapsed by default
  lines.push(`🗓 <b>${t('upcoming', { days: forecast.upcoming.length })}</b>`);
  const upcomingRows = forecast.upcoming.map((day) => {
    // Built by hand: Intl formats { weekday, day } as "4 Sun".
    const dayLabel = `${formatDate(day.date, { weekday: 'short' })} ${Number(day.date.slice(8))}`;
    return `<b>${dayLabel}</b>  ${renderCompact(day.events, time)}`;
  });
  lines.push(`<blockquote expandable>${upcomingRows.join('\n')}</blockquote>`);
  return lines;
}

function renderCompact(events: TideEvent[], time: (value: number) => string): string {
  if (events.length === 0) return '—';
  return events.map((event) => `${TIDE_ICON[event.type]} ${time(event.time)}`).join(' · ');
}
