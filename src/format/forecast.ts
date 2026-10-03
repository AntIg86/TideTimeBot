import { dayKey, type TideEvent, type TideForecast, type TideType } from '../domain/tides';
import { t, type Locale } from '../i18n';

const TIDE_ICON: Record<TideType, string> = { high: '🌊', low: '🏖️' };

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function formatTime(time: number, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(time);
}

/** Formats a YYYY-MM-DD key; noon UTC keeps the calendar date stable in any formatter. */
function formatDate(date: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function formatHeight(height: number, locale: Locale): string {
  const rounded = Math.round(height * 10) / 10;
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${formatNumber(Math.abs(rounded), locale)} ${t(locale, 'meters')}`;
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

export function renderForecast(forecast: TideForecast, placeName: string, locale: Locale): string {
  const { timezone: tz, today } = forecast;
  const time = (value: number) => formatTime(value, locale, tz);
  const lines: string[] = [];

  lines.push(`🌊 <b>${t(locale, 'title')}</b> · ${escapeHtml(placeName)}`, '');

  const trendIcon = forecast.trend === 'falling' ? '📉' : '📈';
  lines.push(`${trendIcon} ${t(locale, 'now')}: ${t(locale, forecast.trend ?? 'unknown')}`);
  if (forecast.next) {
    const { next } = forecast;
    const nextDay = dayKey(next.time, tz);
    const dayNote = nextDay === today.date ? '' : ` (${formatDate(nextDay, locale, { weekday: 'short' })})`;
    lines.push(
      `🔜 ${t(locale, 'next')}: ${TIDE_ICON[next.type]} ${t(locale, next.type)} ${t(locale, 'at')} <b>${time(next.time)}</b>${dayNote}`,
    );
  }
  lines.push('');

  const todayLabel = formatDate(today.date, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  lines.push(`📅 <b>${t(locale, 'today')}, ${todayLabel}</b>`);
  if (today.events.length === 0) {
    lines.push(`<i>${t(locale, 'noTides')}</i>`);
  }
  for (const event of today.events) {
    lines.push(`${TIDE_ICON[event.type]} <b>${time(event.time)}</b>  ${t(locale, event.type)} · ${formatHeight(event.height, locale)}`);
  }

  const conditions = today.conditions;
  if (conditions) {
    const extras: string[] = [];
    if (conditions.waveMax !== null) extras.push(`🏄 ${t(locale, 'waves', { value: formatNumber(conditions.waveMax, locale) })}`);
    if (conditions.windMax !== null) extras.push(`💨 ${t(locale, 'wind', { value: formatNumber(conditions.windMax, locale) })}`);
    if (extras.length) lines.push(extras.join(' · '));
    if (conditions.sunrise !== null && conditions.sunset !== null) {
      lines.push(`🌅 ${time(conditions.sunrise)} · 🌇 ${time(conditions.sunset)}`);
    }
  }
  lines.push('');

  lines.push(`🗓 <b>${t(locale, 'upcoming')}</b>`);
  for (const day of forecast.upcoming) {
    // Built by hand: Intl orders weekday/day differently per locale ("4 Sun").
    const label = `${capitalize(formatDate(day.date, locale, { weekday: 'short' }))} ${Number(day.date.slice(8))}`;
    lines.push(`<b>${label}</b>  ${renderCompact(day.events, time)}`);
  }
  lines.push('', `🌍 <i>${escapeHtml(tz)}</i>`);

  return lines.join('\n');
}

function renderCompact(events: TideEvent[], time: (value: number) => string): string {
  if (events.length === 0) return '—';
  return events.map((event) => `${TIDE_ICON[event.type]} ${time(event.time)}`).join(' · ');
}
