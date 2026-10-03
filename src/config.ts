import dotenv from 'dotenv';

dotenv.config();

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

const botToken = optional('BOT_TOKEN');
if (!botToken) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

export const config = {
  botToken,
  port: Number(optional('PORT') ?? 3000),
  /** Telegram sends it in X-Telegram-Bot-Api-Secret-Token; set the same value in setWebhook. */
  webhookSecret: optional('WEBHOOK_SECRET'),
  /** Contact for the Nominatim usage policy (sent in User-Agent). */
  nominatimEmail: optional('NOMINATIM_EMAIL'),
} as const;
