import { createServer } from 'node:http';
import { bot } from './bot';
import { config } from './config';
import { createWebhookHandler } from './webhook';

// Webhook server for Docker/Render.
const server = createServer(createWebhookHandler(bot));

server.listen(config.port, () => console.log(`Webhook server listening on port ${config.port}`));

const shutdown = () => server.close(() => process.exit(0));
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
