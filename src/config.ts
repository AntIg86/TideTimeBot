import dotenv from 'dotenv';

dotenv.config();

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is missing in environment variables');
}

export const config = {
  botToken: process.env.BOT_TOKEN,
};
