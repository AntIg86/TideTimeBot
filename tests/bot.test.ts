import { afterEach, describe, expect, it, vi } from 'vitest';

process.env.BOT_TOKEN ??= 'test-token';
const { createBot } = await import('../src/bot');

function botWithRecordedCalls(failing: string[] = []) {
  const bot = createBot('123:test');
  bot.botInfo = {
    id: 123,
    is_bot: true,
    first_name: 'Test',
    username: 'test_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  } as typeof bot.botInfo;
  const calls: Array<{ method: string; payload: Record<string, unknown> }> = [];
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    if (failing.includes(method)) {
      return { ok: false, error_code: 400, description: "Bad Request: can't parse rich message" } as never;
    }
    return { ok: true, result: true } as never;
  });
  return { bot, calls };
}

function textUpdate(text: string) {
  const from = { id: 1, is_bot: false, first_name: 'User' };
  return {
    update_id: 1,
    message: { message_id: 1, date: 0, chat: { id: 1, type: 'private' as const, first_name: 'User' }, from, text },
  };
}

describe('bot error handling', () => {
  it('replies with a localized message instead of throwing (webhook mode)', async () => {
    const { bot, calls } = botWithRecordedCalls();
    await expect(bot.handleUpdate(textUpdate('x'.repeat(150)))).resolves.toBeUndefined();

    const reply = calls.find((call) => call.method === 'sendMessage');
    expect(reply?.payload.text).toBe('❌ The name is too long. Please send a shorter city name.');
  });
});

describe('forecast replies', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubApis() {
    const heights = Array.from({ length: 48 }, (_, i) => Math.round(Math.cos((2 * Math.PI * i) / 12.42) * 100) / 100);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string) => {
        const url = new URL(input);
        if (url.host.startsWith('nominatim')) {
          return new Response(JSON.stringify({ lat: '43.46', lon: '-3.81', display_name: 'Santander, Cantabria, Spain' }));
        }
        if (url.host.startsWith('marine')) {
          const now = Math.floor(Date.now() / 1000);
          const time = heights.map((_, i) => now - 24 * 3600 + i * 3600);
          return new Response(JSON.stringify({ latitude: 43.5, longitude: -3.8, timezone: 'Europe/Madrid', hourly: { time, sea_level_height_msl: heights } }));
        }
        return new Response(JSON.stringify({ timezone: 'Europe/Madrid', daily: { time: [] } }));
      }),
    );
  }

  function locationUpdate() {
    const from = { id: 1, is_bot: false, first_name: 'User' };
    const chat = { id: 1, type: 'private' as const, first_name: 'User' };
    return { update_id: 2, message: { message_id: 2, date: 0, chat, from, location: { latitude: 43.46, longitude: -3.81 } } };
  }

  it('sends the forecast as a rich message', async () => {
    stubApis();
    const { bot, calls } = botWithRecordedCalls();
    await bot.handleUpdate(locationUpdate());

    const rich = calls.find((call) => call.method === 'sendRichMessage');
    expect((rich?.payload.rich_message as { html: string }).html).toContain('<table striped compact>');
    expect(calls.some((call) => call.method === 'sendMessage')).toBe(false);
  });

  it('falls back to classic HTML when Telegram rejects the rich message', async () => {
    stubApis();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { bot, calls } = botWithRecordedCalls(['sendRichMessage']);
    await bot.handleUpdate(locationUpdate());

    const classic = calls.find((call) => call.method === 'sendMessage');
    expect(classic?.payload.parse_mode).toBe('HTML');
    expect(classic?.payload.text).toContain('<blockquote expandable>');
  });
});
