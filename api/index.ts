import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';
import { config } from '../src/config';

// Vercel Serverless Function: every request is rewritten here (see vercel.json).
export default webhookCallback(bot, 'http', { secretToken: config.webhookSecret });
