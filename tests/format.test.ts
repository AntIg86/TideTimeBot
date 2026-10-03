import { describe, expect, it } from 'vitest';
import type { TideForecast } from '../src/domain/tides';
import { escapeHtml, renderForecast, renderRichForecast } from '../src/format/forecast';

const timezone = 'Europe/Lisbon';
const forecast: TideForecast = {
  timezone,
  hasTides: true,
  trend: 'rising',
  next: { time: Date.UTC(2026, 9, 3, 16, 45), type: 'high', height: 1.46 },
  waterTemperature: 20.94,
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
    expect(html).toContain('\n\n🌡️ <b>Water:</b> 20.9 °C\n🏄 <b>Waves:</b>');
    expect(html).toContain('🏄 <b>Waves:</b> up to 1.8 m');
    expect(html).toContain('💨 <b>Wind:</b> up to 6.0 m/s');
    expect(html).toContain('☀️ <b>Sun:</b> 🌅 07:32 · 🌇 19:14');
  });

  it("puts today's tides in a quote", () => {
    expect(html).toContain('📅 <b>Today, Sat, Oct 3</b>');
    expect(html).toContain('<blockquote>• <b>05:12</b>  🌊 high tide · +1.4 m\n• <b>11:30</b>  🏖️ low tide · −1.2 m');
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

  it('omits the water temperature when the model has none', () => {
    expect(renderForecast({ ...forecast, waterTemperature: null }, { name: 'Bay' })).not.toContain('Water');
  });

  it('hides near-zero wave heights', () => {
    const calm = { ...forecast.today.conditions!, waveMax: 0.02 };
    expect(renderForecast({ ...forecast, today: { ...forecast.today, conditions: calm } }, { name: 'Bay' })).not.toContain('Waves');
  });

  it('escapes the place name', () => {
    expect(renderForecast(forecast, { name: 'A<b>&' })).toContain('📍 <b>A&lt;b&gt;&amp;</b>');
  });
});

describe('renderRichForecast', () => {
  const html = renderRichForecast(forecast, { name: 'Lisbon, Portugal' });

  it('uses paragraphs and a section heading instead of newlines and rules', () => {
    expect(html).not.toContain('\n');
    expect(html).not.toContain('<hr/>');
    expect(html.startsWith('<p>🌊 <b>Tide forecast</b><br>📍 <b>Lisbon, Portugal</b></p><p>📈 <b>Now:</b>')).toBe(true);
    expect(html.endsWith('</details><footer>&#160;<br>🌍 <i>Europe/Lisbon</i></footer>')).toBe(true);
  });

  it("shows today's tides as a table with the next tide highlighted", () => {
    expect(html).toContain(
      '<h4>📅 <b>Today, Sat, Oct 3</b></h4><table bordered striped>' +
        '<tr><th>Time</th><th>Tide</th><th align="right">Height</th></tr>' +
        '<tr><td><b>05:12</b></td><td>🌊 high tide</td><td align="right">+1.4 m</td></tr>' +
        '<tr><td><b>11:30</b></td><td>🏖️ low tide</td><td align="right">−1.2 m</td></tr>' +
        '<tr><td><mark><b>17:45</b></mark></td><td><mark>🌊 high tide</mark></td><td align="right"><mark>+1.5 m</mark></td></tr>' +
        '</table>',
    );
  });

  it('says so when today has no tides', () => {
    const empty = { ...forecast, today: { ...forecast.today, events: [] } };
    const rich = renderRichForecast(empty, { name: 'X' });
    expect(rich).toContain('<h4>📅 <b>Today, Sat, Oct 3</b></h4><p><i>no tides</i></p>');
    expect(rich).not.toContain('<th>');
  });

  it('puts the upcoming days in a padded table inside details', () => {
    expect(html).toContain(
      '<details><summary>🗓 <b>Next 2 days</b></summary><table striped compact>' +
        '<tr><td><b>Sun 4</b></td><td>🏖️ 00:40</td></tr>' +
        '<tr><td><b>Mon 5</b></td><td>—</td></tr>' +
        '</table></details>',
    );
  });

  it('pads shorter rows to the widest one', () => {
    const wide = {
      ...forecast,
      upcoming: [
        { date: '2026-10-04', events: forecast.today.events },
        { date: '2026-10-05', events: forecast.today.events.slice(0, 1) },
      ],
    };
    expect(renderRichForecast(wide, { name: 'X' })).toContain('<tr><td><b>Mon 5</b></td><td>🌊 05:12</td><td></td><td></td></tr>');
  });

  it('skips the schedule for tideless seas', () => {
    const tideless = renderRichForecast({ ...forecast, hasTides: false, trend: null, next: null }, { name: 'Sochi' });
    expect(tideless).not.toContain('<table');
    expect(tideless).toContain('〰️ Tides here are negligible');
  });
});
