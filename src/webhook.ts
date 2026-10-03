import type { IncomingMessage, ServerResponse } from 'node:http';
import { webhookCallback, type Bot } from 'grammy';
import { config } from './config';

// A forecast makes up to two sequential upstream calls of 5 s each (see services/http.ts),
// plus getMe on a cold start. Keep the budget well above that, and on timeout answer
// Telegram anyway: a 500 makes it redeliver the update and the user gets duplicates.
const WEBHOOK_TIMEOUT_MS = 20_000;

/** Node HTTP handler shared by the Vercel function and the Docker/Render server. */
export function createWebhookHandler(bot: Bot) {
  const handleUpdate = webhookCallback(bot, 'http', {
    secretToken: config.webhookSecret,
    onTimeout: 'return',
    timeoutMilliseconds: WEBHOOK_TIMEOUT_MS,
  });

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Only POST carries a Telegram update; anything else (browsers, health checks) gets 200.
    if (req.method !== 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }

    try {
      await handleUpdate(req, res);
    } catch (error) {
      console.error('Webhook handler failed:', error);
      if (!res.headersSent) res.writeHead(500).end();
    }
  };
}
