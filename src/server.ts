import { createServer } from 'node:http';
import { webhookCallback } from 'grammy';
import { bot } from './bot';
import { config } from './config';

// Webhook server for Docker/Render. Any POST is treated as a Telegram update;
// everything else answers 200 so platform health checks pass.
const handleUpdate = webhookCallback(bot, 'http', { secretToken: config.webhookSecret });

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
    return;
  }

  handleUpdate(req, res).catch((error: unknown) => {
    console.error('Webhook handler failed:', error);
    if (!res.headersSent) res.writeHead(500).end();
  });
});

server.listen(config.port, () => console.log(`Webhook server listening on port ${config.port}`));

const shutdown = () => server.close(() => process.exit(0));
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
