import { Bot, type BotError, type Context } from 'grammy';
import { config } from './config';
import { UserError } from './errors';
import { cityHandler, sharedLocationHandler } from './handlers/forecast';
import { locationCommand } from './handlers/location';
import { startCommand } from './handlers/start';
import { resolveLocale, t } from './i18n';

async function handleError({ ctx, error }: BotError<Context>) {
  const locale = resolveLocale(ctx.from?.language_code);
  let text: string;
  if (error instanceof UserError) {
    text = t(locale, error.key, error.params);
  } else {
    // Log the error only: the context holds the API client with the bot token.
    console.error(`Error while handling update ${ctx.update.update_id}:`, error);
    text = t(locale, 'unexpectedError');
  }

  try {
    await ctx.reply(`❌ ${text}`);
  } catch (replyError) {
    console.error('Failed to send error reply to Telegram:', replyError);
  }
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  // bot.catch() only applies to long polling; with webhooks an escaped error becomes
  // an HTTP 500 and Telegram redelivers the same update forever. The error boundary
  // handles errors in both modes.
  const handlers = bot.errorBoundary(handleError);
  handlers.command(['start', 'help'], startCommand);
  handlers.command('location', locationCommand);
  handlers.on('message:text', cityHandler);
  handlers.on('message:location', sharedLocationHandler);

  return bot;
}

export const bot = createBot(config.botToken);
