import { BotService } from "./bot/service";
import { getConfig } from "./config";
import { startServer } from "./server";

const config = getConfig();
const server = startServer(config);

const bot = new BotService(config);
await bot.start();

console.log(`HTTP server listening on http://localhost:${server.port}`);
