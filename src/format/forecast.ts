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

/** Message parts as inline HTML lines, shared by the classic and the rich layout. */
interface Sections {
  header: string[];
  now: string[];
  details: string[];
  schedule: {
    todayTitle: string;
    todayRows: string[];
    upcomingTitle: string;
    /** Per day: bold label and one cell per tide (icon + time). */
    upcoming: Array<{ label: string; tides: string[] }>;
  } | null;
  footer: string;
}

function buildSections(forecast: TideForecast, place: PlaceLabel): Sections {
  const { timezone: tz, today } = forecast;
  const time = (value: number) => formatTime(value, tz);
  const label = (key: MessageKey) => `<b>${t(key)}:</b>`;

  const header = [`🌊 <b>${t('title')}</b>`, `📍 <b>${escapeHtml(place.name)}</b>`];
  if (place.seaPointKm !== undefined) {
    header.push(`<i>🧭 ${t('seaPoint', { km: Math.round(place.seaPointKm) })}</i>`);
  }

  const now: string[] = [];
  if (!forecast.hasTides) {
    now.push(`〰️ ${t('negligibleTides')}`);
  } else {
    const trendIcon = forecast.trend === 'falling' ? '📉' : '📈';
    now.push(`${trendIcon} ${label('now')} ${t(forecast.trend ?? 'unknown')}`);
    if (forecast.next) {
      const { next } = forecast;
      const nextDay = dayKey(next.time, tz);
      const dayNote = nextDay === today.date ? '' : ` (${formatDate(nextDay, { weekday: 'short' })})`;
      now.push(`🔜 ${label('next')} ${TIDE_ICON[next.type]} ${t(next.type)} ${t('at')} <b>${time(next.time)}</b>${dayNote}`);
    }
  }

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

  const tide = (event: TideEvent) => `${TIDE_ICON[event.type]} ${time(event.time)}`;
  const schedule = forecast.hasTides
    ? {
        todayTitle: `📅 <b>${t('today')}, ${formatDate(today.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b>`,
        todayRows: today.events.map(
          (event) => `• <b>${time(event.time)}</b>  ${TIDE_ICON[event.type]} ${t(event.type)} · ${formatHeight(event.height)}`,
        ),
        upcomingTitle: `🗓 <b>${t('upcoming', { days: forecast.upcoming.length })}</b>`,
        upcoming: forecast.upcoming.map((day) => ({
          // Built by hand: Intl formats { weekday, day } as "4 Sun".
          label: `<b>${formatDate(day.date, { weekday: 'short' })} ${Number(day.date.slice(8))}</b>`,
          tides: day.events.map(tide),
        })),
      }
    : null;

  return { header, now, details, schedule, footer: `🌍 <i>${escapeHtml(tz)}</i>` };
}

/** Classic Telegram HTML (sendMessage with parse_mode HTML). */
export function renderForecast(forecast: TideForecast, place: PlaceLabel): string {
  const { header, now, details, schedule, footer } = buildSections(forecast, place);
  const lines = [...header, DIVIDER, ...now];
  if (details.length) lines.push('', ...details);
  lines.push(DIVIDER);

  if (schedule) {
    const todayRows = schedule.todayRows.length ? schedule.todayRows.join('\n') : `<i>${t('noTides')}</i>`;
    const upcomingRows = schedule.upcoming.map(
      (day) => `${day.label}  ${day.tides.length ? day.tides.join(' · ') : '—'}`,
    );
    lines.push(
      schedule.todayTitle,
      `<blockquote>${todayRows}</blockquote>`,
      schedule.upcomingTitle,
      `<blockquote expandable>${upcomingRows.join('\n')}</blockquote>`,
    );
  }

  lines.push(footer);
  return lines.join('\n');
}

/**
 * Rich message HTML (sendRichMessage, Bot API 10.3+): the same layout, but the upcoming
 * days are a real table inside a collapsible <details> block, so the columns line up.
 */
export function renderRichForecast(forecast: TideForecast, place: PlaceLabel): string {
  const { header, now, details, schedule, footer } = buildSections(forecast, place);
  const paragraph = (lines: string[]) => `<p>${lines.join('<br>')}</p>`;
  const blocks = [paragraph(header), '<hr/>', paragraph(now)];
  if (details.length) blocks.push(paragraph(details));
  blocks.push('<hr/>');

  if (schedule) {
    const todayRows = schedule.todayRows.length ? schedule.todayRows.join('<br>') : `<i>${t('noTides')}</i>`;
    blocks.push(paragraph([schedule.todayTitle]), `<blockquote>${todayRows}</blockquote>`);

    // Rows have 2–5 tides; pad them so every row has the same number of cells.
    const columns = Math.max(1, ...schedule.upcoming.map((day) => day.tides.length));
    const rows = schedule.upcoming.map((day) => {
      const cells = Array.from({ length: columns }, (_, i) => day.tides[i] ?? (i === 0 ? '—' : ''));
      return `<tr><td>${day.label}</td>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    });
    blocks.push(
      `<details><summary>${schedule.upcomingTitle}</summary><table striped compact>${rows.join('')}</table></details>`,
    );
  }

  blocks.push(`<footer>${footer}</footer>`);
  return blocks.join('');
}
