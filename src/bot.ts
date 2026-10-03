import { Bot } from 'grammy';
import { config } from './config';
import { UserError } from './errors';
import { cityHandler, sharedLocationHandler } from './handlers/forecast';
import { locationCommand } from './handlers/location';
import { startCommand } from './handlers/start';
import { resolveLocale, t } from './i18n';

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command(['start', 'help'], startCommand);
  bot.command('location', locationCommand);
  bot.on('message:text', cityHandler);
  bot.on('message:location', sharedLocationHandler);

  bot.catch(async ({ ctx, error }) => {
    const locale = resolveLocale(ctx.from?.language_code);
    let text: string;
    if (error instanceof UserError) {
      text = t(locale, error.key, error.params);
    } else {
      console.error(`Error while handling update ${ctx.update.update_id}:`, error);
      text = t(locale, 'unexpectedError');
    }

    try {
      await ctx.reply(`❌ ${text}`);
    } catch (replyError) {
      console.error('Failed to send error reply to Telegram:', replyError);
    }
  });

  return bot;
}

export const bot = createBot(config.botToken);
