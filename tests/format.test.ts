import { describe, expect, it } from 'vitest';
import type { TideForecast } from '../src/domain/tides';
import { escapeHtml, renderForecast } from '../src/format/forecast';

const timezone = 'Europe/Lisbon';
const forecast: TideForecast = {
  timezone,
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
      time: Date.UTC(2026, 9, 2, 23, 0),
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
  it('renders an English forecast in local time', () => {
    const html = renderForecast(forecast, 'Lisbon, Portugal', 'en');
    expect(html).toContain('🌊 <b>Tide forecast</b> · Lisbon, Portugal');
    expect(html).toContain('📈 Now: rising');
    expect(html).toContain('🔜 Next: 🌊 high tide at <b>17:45</b>');
    expect(html).toContain('🌊 <b>05:12</b>  high tide · +1.4 m');
    expect(html).toContain('🏖️ <b>11:30</b>  low tide · −1.2 m');
    expect(html).toContain('🏄 waves up to 1.8 m · 💨 wind up to 6.0 m/s');
    expect(html).toContain('🌅 07:32 · 🌇 19:14');
    // 23:40 UTC on the 3rd is 00:40 on the 4th in Lisbon.
    expect(html).toContain('<b>Sun 4</b>  🏖️ 00:40');
    expect(html).toContain('<b>Mon 5</b>  —');
  });

  it('renders a Russian forecast', () => {
    const html = renderForecast(forecast, 'Лиссабон, Португалия', 'ru');
    expect(html).toContain('📈 Сейчас: прилив');
    expect(html).toContain('🌊 <b>05:12</b>  полная вода · +1,4 м');
    expect(html).toContain('🗓 <b>Следующие дни</b>');
    expect(html).toContain('<b>Вс 4</b>  🏖️ 00:40');
  });

  it('escapes the place name', () => {
    expect(renderForecast(forecast, 'A<b>&', 'en')).toContain('· A&lt;b&gt;&amp;');
  });
});
