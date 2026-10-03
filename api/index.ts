import type { IncomingMessage, ServerResponse } from 'node:http';
import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';
import { config } from '../src/config';

const handleUpdate = webhookCallback(bot, 'http', { secretToken: config.webhookSecret });

// Vercel Serverless Function: every request is rewritten here (see vercel.json).
// Only POST carries a Telegram update; anything else (browsers, health checks) gets 200.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  await handleUpdate(req, res);
}
