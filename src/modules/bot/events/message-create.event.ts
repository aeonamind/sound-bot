import { Logger } from "@nestjs/common";
import { Events, type GuildTextBasedChannel, type Message } from "discord.js";
import { QueryType, useMainPlayer } from "discord-player";
import type { BotEvent } from "../interfaces";

const logger = new Logger("MessageEvent");
const PREFIX = "!";

const event: BotEvent<typeof Events.MessageCreate> = {
	name: Events.MessageCreate,

	async execute(message: Message) {
		// Ignore bots and messages without prefix
		if (message.author.bot) return;
		if (!message.content.startsWith(PREFIX)) return;
		if (!message.guild) return; // Ignore DMs

		const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
		const commandName = args.shift()?.toLowerCase();

		if (!commandName) return;

		const channel = message.channel as GuildTextBasedChannel;

		// Legacy prefix command: !play
		if (commandName === "play") {
			if (args.length === 0) {
				return channel.send("❌ Please provide a song name or URL.");
			}

			const voiceChannel = message.member?.voice.channel;
			if (!voiceChannel) {
				return channel.send(
					"❌ You need to be in a voice channel to use this command.",
				);
			}

			try {
				const player = useMainPlayer();
				const query = args.join(" ");

				const result = await player.search(query, {
					requestedBy: message.author,
					searchEngine: QueryType.AUTO,
				});

				if (!result || !result.tracks.length) {
					return channel.send("❌ No results found!");
				}

				await player.play(voiceChannel, result, {
					nodeOptions: {
						metadata: {
							channel: channel,
							client: message.client,
							requestedBy: message.author,
						},
						leaveOnEmptyCooldown: 60000,
						leaveOnEndCooldown: 60000,
						leaveOnEmpty: true,
						leaveOnEnd: true,
						selfDeaf: true,
					},
				});

				channel.send(`🎵 | Loading: **${result.tracks[0].title}**`);
			} catch (error) {
				logger.error("Error playing music:", error);
				channel.send("❌ An error occurred while trying to play the song.");
			}
		}
	},
};

export = event;
