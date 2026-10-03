# Tide Time Bot 🌊

A Telegram bot that shows tide times for any coastal location: a detailed view for today (current trend, next tide, heights, waves, wind, sunrise/sunset) plus high/low tide times for the next 7 days in a collapsible block. Data comes from Open-Meteo and OpenStreetMap Nominatim.

## Features

- **Today in detail**: high/low tide times with heights, rising/falling trend and the next tide.
- **7-day outlook**: high and low tide times for each of the next 7 days.
- **Marine conditions**: today's maximum wave height and wind speed, sunrise and sunset.
- **City search or shared location**: send a city name or a location pin 📍.
- **Nearest sea point**: if the place itself has no sea-level data (bays, fjords, river mouths), tides come from the nearest sea point within 60 km, and the message says how far it is.
- **Tideless seas**: for places like the Black Sea or the Baltic, where the level only drifts with wind, the bot says so instead of listing noise.
- **Correct local time**: times are computed from UTC timestamps and the place's IANA timezone, so DST changes inside the forecast window are handled.

## Prerequisites

- Node.js 20+ (22+ recommended)
- [pnpm](https://pnpm.io/)
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)

## Setup

```bash
git clone <repository-url>
cd TideTimeBot
pnpm install
cp .env.example .env   # then fill in BOT_TOKEN
```

| Variable          | Required | Description                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------------- |
| `BOT_TOKEN`       | yes      | Telegram bot token                                                          |
| `PORT`            | no       | Port of the webhook server (default `3000`)                                 |
| `WEBHOOK_SECRET`  | no       | Secret checked against `X-Telegram-Bot-Api-Secret-Token`                     |
| `NOMINATIM_EMAIL` | no       | Contact sent to Nominatim in `User-Agent` (recommended by their usage policy) |

## Running

### Local development (long polling)

```bash
pnpm dev
```

Long polling **removes the webhook** registered for the token. Use a separate test bot, or register the webhook again afterwards (see below).

### Docker / Render (webhook server)

`src/server.ts` starts an HTTP server: `POST` requests are Telegram updates, any other request returns `200 ok` for health checks.

```bash
docker build -t tide-time-bot .
docker run -p 3000:3000 --env-file .env tide-time-bot
```

`render.yaml` deploys the same image to Render.

### Vercel (serverless webhook)

`api/index.ts` is the webhook function; `vercel.json` routes all requests to it. Set `BOT_TOKEN` (and optionally `WEBHOOK_SECRET`) in the project's environment variables.

### Registering the webhook

After deploying to Docker/Render or Vercel, point Telegram at your URL:

```bash
curl "https://api.telegram.org/bot$BOT_TOKEN/setWebhook?url=https://your-app.example.com/&secret_token=$WEBHOOK_SECRET"
```

## Scripts

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Long polling with auto-reload (`tsx watch`)  |
| `pnpm build`         | Compile TypeScript to `dist/`                |
| `pnpm start`         | Run the webhook server (`dist/server.js`)    |
| `pnpm start:polling` | Run long polling from the build              |
| `pnpm typecheck`     | Type-check without emitting                  |
| `pnpm test`          | Run unit tests (Vitest)                      |

## Usage

1. Send `/start` (or `/help`).
2. Send a city name, e.g. `Lisbon`, or share a location.
3. `/location <city>` shows the place and coordinates the geocoder found.

## How tides are computed

Open-Meteo provides hourly `sea_level_height_msl`. High and low tides are found with a zigzag filter: an extremum counts only once the level has moved away from it by at least 10 cm, which removes rounding noise. Times and heights are refined with a parabola through the neighbouring samples. A place counts as tideless when there is less than one extremum per day. Heights are relative to mean sea level, not to chart datum, so they differ from official port tide tables. Treat the data as guidance, not for navigation.

## Project structure

```
api/index.ts              Vercel webhook function
src/bot.ts                Bot setup, handlers, error handling
src/polling.ts            Long-polling entry point (dev)
src/server.ts             Webhook HTTP server (Docker/Render)
src/config.ts             Environment variables
src/messages.ts           User-facing texts
src/errors.ts             User-facing errors
src/handlers/             Telegram command and message handlers
src/services/             Nominatim and Open-Meteo clients
src/domain/tides.ts       Tide extremes and forecast assembly (pure)
src/domain/geo.ts         Distances and search rings (pure)
src/webhook.ts            Webhook handler shared by Vercel and the server
src/format/forecast.ts    Telegram HTML rendering (pure)
tests/                    Vitest unit tests
```

## License

ISC
