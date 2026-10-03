import { bot } from '../src/bot';
import { createWebhookHandler } from '../src/webhook';

// Vercel Serverless Function: every request is rewritten here (see vercel.json).
export default createWebhookHandler(bot);
