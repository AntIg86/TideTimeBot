import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

process.env.BOT_TOKEN ??= 'test-token';
const { createBot } = await import('../src/bot');
const { createWebhookHandler } = await import('../src/webhook');

describe('createWebhookHandler', () => {
  it('answers non-POST requests with 200 without touching the bot', async () => {
    const res = { writeHead: vi.fn(), end: vi.fn() };
    res.writeHead.mockReturnValue(res);

    await createWebhookHandler(createBot('123:test'))({ method: 'GET' } as IncomingMessage, res as unknown as ServerResponse);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('ok');
  });
});
