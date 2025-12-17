import { Bot } from 'grammy';
import { config } from './config';
import { getCoordinates } from './services/geocoding';
import { getTides } from './services/tides';
import { locationCommand } from './commands/location';

// 1. Initialize Bot
const bot = new Bot(config.botToken);

// 2. Setup Commands
bot.command('start', (ctx) => 
  ctx.reply('Welcome! 🌊\nI can tell you the tide times.\n\nPlease send me a city name (e.g., "New York") or use /location <city> to test geocoding.')
);

bot.command('location', locationCommand);

// 3. Handle Text Messages (City Names)
bot.on('message:text', async (ctx) => {
  const city = ctx.message.text;

  // Ignore commands (starting with /) in this handler
  if (city.startsWith('/')) return;

  try {
    await ctx.reply(`Searching for tides in ${city}... 🔎`);

    // Step 1: Geocode
    const coords = await getCoordinates(city);
    
    // Step 2: Fetch Tides
    const tideData = await getTides(coords.lat, coords.lon);

    // Step 3: Format Output
    // Helper to extract time HH:MM from Local ISO string "YYYY-MM-DDTHH:MM"
    const formatTime = (isoString: string) => {
        return isoString.split('T')[1] || isoString;
    };

    // Combine and sort events
    const allEvents = [
        ...tideData.highTides.map(t => ({ time: t, type: 'High 🔼' })),
        ...tideData.lowTides.map(t => ({ time: t, type: 'Low 🔽' }))
    ].sort((a, b) => a.time.localeCompare(b.time));

    // Calculate Current Local Time for display
    // We need to construct it from UTC Date + Offset from the tideData
    // tideData.timezone is the name (Europe/Madrid).
    // tideData doesn't explicitly return the offset in the final object, but we used it in service.
    // Let's rely on the user knowing their time or just show the timezone.
    // Actually, showing "Current Status" implies "Right Now".
    
    // Let's improve the symbols
    const statusIcon = tideData.status.includes('Rising') ? '📈' : '📉';
    const cleanStatus = tideData.status.replace(/ .*/, ''); 

    const nextTideStr = tideData.nextTide 
        ? `*${tideData.nextTide.type === 'high' ? 'High 🌊' : 'Low 🏖️'}* at *${formatTime(tideData.nextTide.time)}*` 
        : '_Unknown_';

    const waveHeightStr = tideData.maxWaveHeight !== null 
        ? `${tideData.maxWaveHeight} m` 
        : 'N/A';

    const windSpeedStr = tideData.maxWindSpeed !== null 
        ? `${tideData.maxWindSpeed} m/s` 
        : 'N/A';

    const sunriseStr = tideData.sunrise ? formatTime(tideData.sunrise) : '--:--';
    const sunsetStr = tideData.sunset ? formatTime(tideData.sunset) : '--:--';

    const eventsFormatted = allEvents.map(e => {
        const time = formatTime(e.time);
        const icon = e.type.includes('High') ? '🌊' : '🏖️';
        const type = e.type.replace(/ .*/, ''); 
        return `• *${time}*  ${icon}  ${type}`;
    }).join('\n');

    const message = `
🌊 *Tide Forecast*  |  *${coords.displayName}*

${statusIcon} *Status:* ${cleanStatus}
🔜 *Next:* ${nextTideStr}

🏄 *Max Waves:* ${waveHeightStr}
💨 *Max Wind:* ${windSpeedStr}
☀️ *Sun:* 🌅 ${sunriseStr}  |  🌇 ${sunsetStr}

──────────────────
📅 *Today's Schedule*
──────────────────
${eventsFormatted || '_No more tides today_'}
──────────────────
🌍 _${tideData.timezone}_
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error: any) {
    console.error(`Error processing ${city}:`, error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// 4. Export the Bot instance (for Vercel Webhook)
export { bot };