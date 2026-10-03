import type { Context, Filter } from 'grammy';
import { buildForecast } from '../domain/tides';
import { renderForecast } from '../format/forecast';
import { resolveLocale, type Locale } from '../i18n';
import { getCoordinates, reverseGeocode, type Place } from '../services/geocoding';
import { fetchForecast } from '../services/openMeteo';

const UPCOMING_DAYS = 7;

async function replyWithForecast(ctx: Context, locale: Locale, findPlace: () => Promise<Place>) {
  // Fire and forget: a failed "typing…" indicator must not break the reply.
  ctx.replyWithChatAction('typing').catch(() => {});

  const place = await findPlace();
  const raw = await fetchForecast(place.lat, place.lon);
  const forecast = buildForecast({ ...raw, now: Date.now(), days: UPCOMING_DAYS });

  await ctx.reply(renderForecast(forecast, place.shortName, locale), { parse_mode: 'HTML' });
}

export async function cityHandler(ctx: Filter<Context, 'message:text'>) {
  const city = ctx.message.text.trim();
  // Unknown commands are not city names.
  if (!city || city.startsWith('/')) return;

  const locale = resolveLocale(ctx.from.language_code);
  await replyWithForecast(ctx, locale, () => getCoordinates(city, locale));
}

export async function sharedLocationHandler(ctx: Filter<Context, 'message:location'>) {
  const locale = resolveLocale(ctx.from.language_code);
  const { latitude, longitude } = ctx.message.location;
  await replyWithForecast(ctx, locale, () => reverseGeocode(latitude, longitude, locale));
}
