import { describe, expect, it } from 'vitest';

process.env.BOT_TOKEN ??= 'test-token';
const { createBot } = await import('../src/bot');

function botWithRecordedCalls() {
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
    return { ok: true, result: true } as never;
  });
  return { bot, calls };
}

function textUpdate(text: string, languageCode = 'ru') {
  const from = { id: 1, is_bot: false, first_name: 'User', language_code: languageCode };
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
    expect(reply?.payload.text).toBe('❌ Слишком длинное название. Отправь название города покороче.');
  });
});
