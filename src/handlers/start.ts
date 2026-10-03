import type { Context } from 'grammy';
import { t } from '../messages';

export function startCommand(ctx: Context) {
  return ctx.reply(t('welcome'));
}
