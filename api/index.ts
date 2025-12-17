import { webhookCallback } from 'grammy';
import { bot } from '../src/bot';

// Vercel Serverless Function Handler
// grammY's webhookCallback creates a handler compatible with standard HTTP requests (req, res)
export default webhookCallback(bot, 'http');
