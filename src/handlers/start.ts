import type { Context } from 'grammy';
import { resolveLocale, t } from '../i18n';

export function startCommand(ctx: Context) {
  return ctx.reply(t(resolveLocale(ctx.from?.language_code), 'welcome'));
}
