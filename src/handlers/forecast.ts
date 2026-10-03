import { GrammyError, type Context, type Filter } from 'grammy';
import { buildForecast } from '../domain/tides';
import { renderForecast, renderRichForecast } from '../format/forecast';
import { getCoordinates, reverseGeocode, type Place } from '../services/geocoding';
import { fetchForecast } from '../services/openMeteo';

const UPCOMING_DAYS = 7;

async function replyWithForecast(ctx: Context, findPlace: () => Promise<Place>) {
  // Fire and forget: a failed "typing…" indicator must not break the reply.
  ctx.replyWithChatAction('typing').catch(() => {});

  const place = await findPlace();
  const raw = await fetchForecast(place.lat, place.lon);
  const forecast = buildForecast({ ...raw, now: Date.now(), days: UPCOMING_DAYS });

  const label = { name: place.shortName, seaPointKm: raw.seaPoint?.distanceKm };
  try {
    await ctx.replyWithRichMessage({ html: renderRichForecast(forecast, label) });
  } catch (error) {
    // Rich messages are new (Bot API 10.3); if Telegram rejects one, send the classic layout.
    if (!(error instanceof GrammyError)) throw error;
    console.error('Rich message rejected, falling back to classic HTML:', error.description);
    await ctx.reply(renderForecast(forecast, label), { parse_mode: 'HTML' });
  }
}

export async function cityHandler(ctx: Filter<Context, 'message:text'>) {
  const city = ctx.message.text.trim();
  // Unknown commands are not city names.
  if (!city || city.startsWith('/')) return;

  await replyWithForecast(ctx, () => getCoordinates(city));
}

export async function sharedLocationHandler(ctx: Filter<Context, 'message:location'>) {
  const { latitude, longitude } = ctx.message.location;
  await replyWithForecast(ctx, () => reverseGeocode(latitude, longitude));
}
