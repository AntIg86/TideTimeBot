# Tide Time Bot 🌊

A Telegram bot that provides real-time tide forecasts, wave heights, wind speeds, and sunrise/sunset times for any coastal location using the Open-Meteo and OpenStreetMap APIs.

## Features

- **Tide Forecasts**: Daily high and low tide times.
- **Current Status**: Indicates if the tide is currently rising or falling.
- **Marine Conditions**: Maximum wave height and wind speed for the day.
- **Sun Cycle**: Sunrise and sunset times.
- **Global Coverage**: Search for any coastal city worldwide.
- **Geocoding**: Converts city names to coordinates automatically.

## Prerequisites

- Node.js (v18 or higher recommended)
- [pnpm](https://pnpm.io/) (or npm/yarn)
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd TideTimeBot
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Configure Environment Variables:**

    Create a `.env` file in the root directory:

    ```bash
    cp .env.example .env  # If .env.example exists, otherwise create new
    ```

    Add your Telegram Bot Token:

    ```env
    BOT_TOKEN=your_telegram_bot_token_here
    PORT=3000 # Optional, defaults to 3000
    ```

## Running the Bot

### Development Mode
Runs the bot with `ts-node` for hot-reloading (if configured) or direct TypeScript execution.

```bash
pnpm run dev
```

### Production Mode
Compiles TypeScript to JavaScript and runs the built files.

```bash
pnpm run build
pnpm start
```

## Usage

1.  Start the bot in Telegram.
2.  Send `/start` to see the welcome message.
3.  **Search for Tides**: Simply type the name of a city (e.g., "Lisbon", "San Francisco").
    *   The bot will reply with the current tide status, next tide, and today's schedule.
4.  **Test Geocoding**: Use `/location <city>` to see the raw coordinates found for a location.

## APIs Used

-   **[Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api)**: For tide, wave, and weather data.
-   **[OpenStreetMap Nominatim](https://nominatim.org/)**: For geocoding city names to coordinates.

## Project Structure

-   `src/bot.ts`: Main entry point and bot logic.
-   `src/services/`: API integration logic (Tides and Geocoding).
-   `src/commands/`: Command handlers.
-   `src/config.ts`: Configuration and environment variable validation.

## License

ISC
