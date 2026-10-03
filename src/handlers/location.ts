import type { CommandContext, Context } from 'grammy';
import { resolveLocale, t } from '../i18n';
import { getCoordinates } from '../services/geocoding';

export async function locationCommand(ctx: CommandContext<Context>) {
  const locale = resolveLocale(ctx.from?.language_code);
  const city = ctx.match.trim();

  if (!city) {
    return ctx.reply(t(locale, 'locationUsage'));
  }

  const place = await getCoordinates(city, locale);
  return ctx.reply(t(locale, 'locationFound', { name: place.displayName, lat: place.lat, lon: place.lon }));
}
