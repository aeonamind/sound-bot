import { type Client, Events } from "discord.js";
import { createLogger } from "../../logger";
import type { BotEvent } from "../types";

const logger = createLogger("ReadyEvent");

const event: BotEvent<typeof Events.ClientReady> = {
	name: Events.ClientReady,
	once: true,

	execute(client: Client<true>) {
		logger.log(`Bot is ready! Logged in as ${client.user.tag}`);
		logger.log(`Serving ${client.guilds.cache.size} guild(s)`);
	},
};

export default event;
