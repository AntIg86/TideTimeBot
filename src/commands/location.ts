import { Context } from 'grammy';
import { getCoordinates } from '../services/geocoding';

export async function locationCommand(ctx: Context) {
  const city = ctx.match;

  if (typeof city !== 'string' || !city.trim()) {
    return ctx.reply('Please provide a city name. Usage: /location <city>');
  }

  try {
    await ctx.reply(`Searching for "${city}"...`);
    const coords = await getCoordinates(city);
    await ctx.reply(
      `Found: ${coords.displayName}\nLatitude: ${coords.lat}\nLongitude: ${coords.lon}`
    );
  } catch (error: any) {
    await ctx.reply(`Error: ${error.message}`);
  }
}
