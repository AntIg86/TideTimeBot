import type { CommandContext, Context } from 'grammy';
import { t } from '../messages';
import { getCoordinates } from '../services/geocoding';

export async function locationCommand(ctx: CommandContext<Context>) {
  const city = ctx.match.trim();

  if (!city) {
    return ctx.reply(t('locationUsage'));
  }

  const place = await getCoordinates(city);
  return ctx.reply(t('locationFound', { name: place.displayName, lat: place.lat, lon: place.lon }));
}
