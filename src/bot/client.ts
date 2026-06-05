import { DefaultExtractors } from "@discord-player/extractor";
import { Client, type ClientOptions, Collection } from "discord.js";
import { Player } from "discord-player";
import { SpotifyExtractor } from "discord-player-spotify";
import { PlayDLExtractor } from "./extractors/play-dl";
import type { Command } from "./types";

export class CustomClient extends Client {
	public readonly commands = new Collection<string, Command>();
	public readonly cooldowns = new Collection<
		string,
		Collection<string, number>
	>();
	public readonly player: Player;

	constructor(options: ClientOptions) {
		super(options);
		this.player = new Player(this);
	}

	async initPlayer(options?: {
		spotifyClientId?: string;
		spotifyClientSecret?: string;
	}): Promise<void> {
		await this.player.extractors.register(PlayDLExtractor, {});

		await this.player.extractors.register(SpotifyExtractor, {
			clientId: options?.spotifyClientId,
			clientSecret: options?.spotifyClientSecret,
		});

		await this.player.extractors.loadMulti(DefaultExtractors, {} as any);

		console.log(`✅ Loaded ${this.player.extractors.size} extractors`);
		console.log(`🎬 YouTube: play-dl | 🎵 Spotify: metadata + bridge`);
	}
}
