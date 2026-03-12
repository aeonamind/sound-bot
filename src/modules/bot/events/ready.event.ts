import { Logger } from "@nestjs/common";
import { type Client, Events } from "discord.js";
import type { BotEvent } from "../interfaces";

const logger = new Logger("ReadyEvent");

const event: BotEvent<typeof Events.ClientReady> = {
	name: Events.ClientReady,
	once: true,

	execute(client: Client<true>) {
		logger.log(`Bot is ready! Logged in as ${client.user.tag}`);
		logger.log(`Serving ${client.guilds.cache.size} guild(s)`);
	},
};

export = event;
