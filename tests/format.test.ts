import { describe, expect, it } from 'vitest';
import type { TideForecast } from '../src/domain/tides';
import { escapeHtml, renderForecast } from '../src/format/forecast';

const timezone = 'Europe/Lisbon';
const forecast: TideForecast = {
  timezone,
  hasTides: true,
  trend: 'rising',
  next: { time: Date.UTC(2026, 9, 3, 16, 45), type: 'high', height: 1.46 },
  today: {
    date: '2026-10-03',
    events: [
      { time: Date.UTC(2026, 9, 3, 4, 12), type: 'high', height: 1.4 },
      { time: Date.UTC(2026, 9, 3, 10, 30), type: 'low', height: -1.23 },
      { time: Date.UTC(2026, 9, 3, 16, 45), type: 'high', height: 1.46 },
    ],
    conditions: {
      date: '2026-10-03',
      waveMax: 1.8,
      windMax: 6.04,
      sunrise: Date.UTC(2026, 9, 3, 6, 32),
      sunset: Date.UTC(2026, 9, 3, 18, 14),
    },
  },
  upcoming: [
    { date: '2026-10-04', events: [{ time: Date.UTC(2026, 9, 3, 23, 40), type: 'low', height: -1 }] },
    { date: '2026-10-05', events: [] },
  ],
};

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<b>Tom & Jerry</b>')).toBe('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;');
  });
});

describe('renderForecast', () => {
  const html = renderForecast(forecast, { name: 'Lisbon, Portugal' });

  it('renders the header and current state', () => {
    expect(html).toContain('🌊 <b>Tide forecast</b>\n📍 <b>Lisbon, Portugal</b>\n──────────────────');
    expect(html).toContain('📈 <b>Now:</b> rising');
    expect(html).toContain('🔜 <b>Next:</b> 🌊 high tide at <b>17:45</b>');
  });

  it('renders labelled conditions in local time', () => {
    expect(html).toContain('🏄 <b>Waves:</b> up to 1.8 m');
    expect(html).toContain('💨 <b>Wind:</b> up to 6.0 m/s');
    expect(html).toContain('☀️ <b>Sun:</b> 🌅 07:32 · 🌇 19:14');
  });

  it("puts today's tides in a quote", () => {
    expect(html).toContain('📅 <b>Today, Sat, Oct 3</b>');
    expect(html).toContain('<blockquote>• <b>05:12</b>  🌊 high tide · <i>+1.4 m</i>\n• <b>11:30</b>  🏖️ low tide · <i>−1.2 m</i>');
  });

  it('puts the upcoming days in an expandable quote', () => {
    expect(html).toContain('🗓 <b>Next 2 days</b>');
    // 23:40 UTC on the 3rd is 00:40 on the 4th in Lisbon.
    expect(html).toContain('<blockquote expandable><b>Sun 4</b>  🏖️ 00:40\n<b>Mon 5</b>  —</blockquote>');
  });

  it('mentions the sea point only when tides come from elsewhere', () => {
    expect(html).not.toContain('🧭');
    expect(renderForecast(forecast, { name: 'Murmansk', seaPointKm: 54.6 })).toContain(
      '<i>🧭 tides for the nearest sea point, 55 km away</i>',
    );
  });

  it('replaces the schedule with a note when the sea is nearly tideless', () => {
    const tideless = renderForecast({ ...forecast, hasTides: false, trend: null, next: null }, { name: 'Sochi, Russia' });
    expect(tideless).toContain('〰️ Tides here are negligible: the sea level only drifts with wind and pressure.');
    expect(tideless).toContain('🏄 <b>Waves:</b> up to 1.8 m');
    expect(tideless).not.toContain('<blockquote');
    expect(tideless).not.toContain('<b>Now:</b>');
  });

  it('hides near-zero wave heights', () => {
    const calm = { ...forecast.today.conditions!, waveMax: 0.02 };
    expect(renderForecast({ ...forecast, today: { ...forecast.today, conditions: calm } }, { name: 'Bay' })).not.toContain('Waves');
  });

  it('escapes the place name', () => {
    expect(renderForecast(forecast, { name: 'A<b>&' })).toContain('📍 <b>A&lt;b&gt;&amp;</b>');
  });
});
