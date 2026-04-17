import * as path from "node:path";
import type { BotConfig } from "@core/configs/bot.config";
import { ConfigName } from "@core/constants/config-name.constant";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	GatewayIntentBits,
	Partials,
	REST,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import { glob } from "glob";
import { CustomClient } from "./clients/custom-client";
import type { BotEvent, Command } from "./interfaces";

@Injectable()
export class BotService implements OnModuleInit {
	private readonly client: CustomClient;
	private readonly botConfig: BotConfig;
	private readonly logger = new Logger(BotService.name);
	private readonly rest: REST;

	constructor(private readonly configService: ConfigService) {
		this.botConfig = this.configService.get<BotConfig>(ConfigName.Bot);
		this.rest = new REST({ version: "10" }).setToken(this.botConfig.token);

		this.client = new CustomClient({
			intents: this.getIntents(),
			partials: this.getPartials(),
		});
	}

	async onModuleInit(): Promise<void> {
		if (!this.botConfig.enabled) {
			this.logger.warn(
				"Bot is disabled via configuration. Skipping initialization.",
			);
			return;
		}

		await this.client.initPlayer({
			spotifyClientId: this.botConfig.spotifyClientId,
			spotifyClientSecret: this.botConfig.spotifyClientSecret,
		});
		this.registerPlayerEvents();
		await this.loadEvents();
		await this.loadCommands();
		await this.start();
	}

	/**
	 * Start the bot and connect to Discord
	 */
	private async start(): Promise<void> {
		try {
			await this.client.login(this.botConfig.token);
		} catch (error) {
			this.logger.error("Failed to start bot:", error);
			throw error;
		}
	}

	/**
	 * Get the required gateway intents
	 */
	private getIntents(): GatewayIntentBits[] {
		return [
			GatewayIntentBits.Guilds,
			GatewayIntentBits.GuildMessages,
			GatewayIntentBits.GuildVoiceStates,
			GatewayIntentBits.GuildMessageReactions,
			GatewayIntentBits.DirectMessages,
			GatewayIntentBits.MessageContent,
		];
	}

	/**
	 * Get the required partials
	 */
	private getPartials(): Partials[] {
		return [Partials.Channel, Partials.Message, Partials.Reaction];
	}

	/**
	 * Load all event handlers using glob pattern matching
	 */
	private async loadEvents(): Promise<void> {
		const eventFiles = await glob("**/*.event.js", {
			cwd: path.join(__dirname, "events"),
			absolute: true,
		});

		for (const file of eventFiles) {
			try {
				const eventModule = await import(file);
				const event: BotEvent = eventModule.default ?? eventModule;

				if (!event.name || !event.execute) {
					this.logger.warn(`Invalid event file: ${file}`);
					continue;
				}

				if (event.once) {
					this.client.once(event.name, (...args) => event.execute(...args));
				} else {
					this.client.on(event.name, (...args) => event.execute(...args));
				}

				this.logger.debug(`Loaded event: ${event.name}`);
			} catch (error) {
				this.logger.error(`Failed to load event ${file}:`, error);
			}
		}

		this.logger.log(`Loaded ${eventFiles.length} events`);
	}

	/**
	 * Load all commands using glob pattern matching and register with Discord
	 */
	private async loadCommands(): Promise<void> {
		const commandFiles = await glob("**/*.command.js", {
			cwd: path.join(__dirname, "commands"),
			absolute: true,
		});

		const commandsJson: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

		for (const file of commandFiles) {
			try {
				const commandModule = await import(file);
				const command: Command = commandModule.default ?? commandModule;

				if (!command.data || !command.execute) {
					this.logger.warn(`Invalid command file: ${file}`);
					continue;
				}

				const commandName = command.data.name;
				this.client.commands.set(commandName, command);
				commandsJson.push(
					command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody,
				);

				this.logger.debug(`Loaded command: ${commandName}`);
			} catch (error) {
				this.logger.error(`Failed to load command ${file}:`, error);
			}
		}

		// Register commands with Discord API
		await this.registerCommands(commandsJson);
		this.logger.log(`Loaded ${this.client.commands.size} commands`);
	}

	/**
	 * Register slash commands with Discord API
	 */
	private async registerCommands(
		commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
	): Promise<void> {
		try {
			const data = (await this.rest.put(
				Routes.applicationCommands(this.botConfig.clientId),
				{ body: commands },
			)) as unknown[];

			this.logger.log(
				`Successfully registered ${data.length} application commands`,
			);
		} catch (error) {
			this.logger.error("Failed to register commands:", error);
			throw error;
		}
	}

	/**
	 * Register discord-player event handlers
	 */
	private registerPlayerEvents(): void {
		const { player } = this.client;

		player.events.on("playerStart", (queue, track) => {
			queue.metadata.channel?.send(
				`🎶 | Now playing: **${track.title}** by **${track.author}**\n` +
					`Duration: \`${track.duration}\` | Requested by: ${track.requestedBy}`,
			);
		});

		player.events.on("audioTrackAdd", (queue, track) => {
			queue.metadata.channel?.send(
				`🎵 | Added to queue: **${track.title}** - \`${track.duration}\``,
			);
		});

		player.events.on("audioTracksAdd", (queue, tracks) => {
			queue.metadata.channel?.send(
				`🎶 | Added **${tracks.length}** tracks to the queue!`,
			);
		});

		player.events.on("playerSkip", (queue, track) => {
			queue.metadata.channel?.send(`⏭️ | Skipped: **${track.title}**`);
		});

		player.events.on("disconnect", (queue) => {
			queue.metadata.channel?.send("❌ | Disconnected from voice channel.");
		});

		player.events.on("emptyChannel", (queue) => {
			queue.metadata.channel?.send(
				"❌ | Nobody is in the voice channel, leaving...",
			);
		});

		player.events.on("emptyQueue", (queue) => {
			queue.metadata.channel?.send("✅ | Queue finished!");
		});

		player.events.on("error", (queue, error) => {
			this.logger.error("Player error:", error);
			queue.metadata.channel?.send(`❌ | Error: ${error.message}`);
		});

		player.events.on("playerError", (queue, error) => {
			this.logger.error("Player error:", error);
			queue.metadata.channel?.send(`❌ | Player error: ${error.message}`);
		});
	}
}
