import { bot } from './bot';

// Long polling for local development. Note: bot.start() deletes any webhook
// registered for this token (e.g. the Vercel deployment) — restore it afterwards.
async function main() {
  const stop = () => bot.stop();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await bot.start({
    onStart: (info) => console.log(`@${info.username} is running (long polling)`),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
