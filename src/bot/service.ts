import { join } from "node:path";
import {
	GatewayIntentBits,
	Partials,
	REST,
	type RESTPostAPIChatInputApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import { glob } from "glob";
import type { BotConfig } from "../config";
import { createLogger } from "../logger";
import {
	isYoutubeBackedTrack,
	isYoutubeStreamError,
	trySoundCloudBridge,
} from "../stream-fallback";
import { CustomClient } from "./client";

export class BotService {
	private readonly client: CustomClient;
	private readonly logger = createLogger(BotService.name);
	private readonly rest: REST;

	constructor(private readonly config: BotConfig) {
		this.rest = new REST({ version: "10" }).setToken(this.config.token);

		this.client = new CustomClient({
			intents: this.getIntents(),
			partials: this.getPartials(),
		});
	}

	async start(): Promise<void> {
		if (!this.config.enabled) {
			this.logger.warn(
				"Bot is disabled via configuration. Skipping initialization.",
			);
			return;
		}

		await this.client.initPlayer({
			spotifyClientId: this.config.spotifyClientId,
			spotifyClientSecret: this.config.spotifyClientSecret,
		});
		this.registerPlayerEvents();
		await this.loadEvents();
		await this.loadCommands();
		await this.login();
	}

	private async login(): Promise<void> {
		try {
			await this.client.login(this.config.token);
		} catch (error) {
			this.logger.error("Failed to start bot:", error);
			throw error;
		}
	}

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

	private getPartials(): Partials[] {
		return [Partials.Channel, Partials.Message, Partials.Reaction];
	}

	private async loadEvents(): Promise<void> {
		const eventFiles = await glob("**/*.ts", {
			cwd: join(import.meta.dir, "events"),
			absolute: true,
		});

		for (const file of eventFiles) {
			try {
				const { default: event } = await import(file);

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

	private async loadCommands(): Promise<void> {
		const commandFiles = await glob("**/*.ts", {
			cwd: join(import.meta.dir, "commands"),
			absolute: true,
		});

		const commandsJson: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

		for (const file of commandFiles) {
			try {
				const { default: command } = await import(file);

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

		await this.registerCommands(commandsJson);
		this.logger.log(`Loaded ${this.client.commands.size} commands`);
	}

	private async registerCommands(
		commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
	): Promise<void> {
		try {
			const data = (await this.rest.put(
				Routes.applicationCommands(this.config.clientId),
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

	private registerPlayerEvents(): void {
		const { player } = this.client;

		player.on("debug", (message) => {
			this.logger.debug(`[player] ${message}`);
		});

		player.events.on("debug", (queue, message) => {
			this.logger.debug(`[queue:${queue.guild.name}] ${message}`);
		});

		player.events.on("playerStart", (queue, track) => {
			this.logger.log(`Now playing: ${track.title}`);
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
			if (
				error.name === "AbortError" ||
				error.message.includes("The operation was aborted") ||
				(error as NodeJS.ErrnoException).code === "ABORT_ERR"
			) {
				this.logger.debug(
					`[player] stream aborted (expected): ${error.message}`,
				);
				return;
			}
			this.logger.error("Player error:", error);
			queue.metadata.channel?.send(`❌ | Error: ${error.message}`);
		});

		player.events.on("playerError", async (queue, error, track) => {
			if (
				error.name === "AbortError" ||
				error.message.includes("The operation was aborted") ||
				(error as NodeJS.ErrnoException).code === "ABORT_ERR"
			) {
				this.logger.debug(
					`[player] stream aborted (expected): ${error.message}`,
				);
				return;
			}

			const currentTrack = track ?? queue.currentTrack;
			if (
				currentTrack &&
				isYoutubeStreamError(error) &&
				isYoutubeBackedTrack(currentTrack)
			) {
				const bridged = await trySoundCloudBridge(queue.player, currentTrack);
				if (bridged) {
					this.logger.warn(
						`YouTube failed for "${currentTrack.title}", retrying via SoundCloud`,
					);
					queue.metadata.channel?.send(
						`⚠️ | YouTube unavailable, trying SoundCloud for **${currentTrack.title}**...`,
					);
					try {
						await queue.node.play(currentTrack, { queue: false });
						return;
					} catch (retryError) {
						this.logger.error("SoundCloud fallback failed:", retryError);
					}
				}
			}

			if (
				error.message.includes("Could not extract stream for this track") ||
				error.name === "NoResultError" ||
				error.message.includes("No suitable source found")
			) {
				const trackTitle = currentTrack?.title ?? "this track";
				this.logger.warn(
					`Bridge failed for "${trackTitle}". No audio source found from YouTube/SoundCloud.`,
				);
				queue.metadata.channel?.send(
					`⏭️ | Could not find audio source for **${trackTitle}**. ` +
						`Try a different song or paste a direct link.`,
				);
				return;
			}

			this.logger.error("Player error:", error);
			queue.metadata.channel?.send(`❌ | Player error: ${error.message}`);
		});

		player.events.on(
			"willPlayTrack" as any,
			(_queue: any, track: any, _config: any, done: () => void) => {
				this.logger.debug(
					`[willPlayTrack] ${track?.title} | extractor: ${track?.extractor?.identifier}`,
				);
				done();
			},
		);
	}
}
