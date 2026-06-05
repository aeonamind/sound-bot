import {
	AppleMusicExtractor,
	AttachmentExtractor,
	ReverbnationExtractor,
	SoundCloudExtractor,
	VimeoExtractor,
} from "@discord-player/extractor";
import { Client, type ClientOptions, Collection } from "discord.js";
import { Player } from "discord-player";
import { SpotifyExtractor } from "discord-player-spotify";
import { initFfmpeg } from "../ffmpeg";
import { PlayDLExtractor } from "./extractors/play-dl";
import type { Command } from "./types";

const secondaryExtractors = [
	SoundCloudExtractor,
	AttachmentExtractor,
	VimeoExtractor,
	ReverbnationExtractor,
	AppleMusicExtractor,
];

export class CustomClient extends Client {
	public readonly commands = new Collection<string, Command>();
	public readonly cooldowns = new Collection<
		string,
		Collection<string, number>
	>();
	public readonly player: Player;

	constructor(options: ClientOptions) {
		super(options);
		const ffmpegPath = initFfmpeg();
		this.player = new Player(this, {
			ffmpegPath,
			skipFFmpeg: false,
		});
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

		await this.player.extractors.loadMulti(secondaryExtractors, {} as any);

		console.log(`✅ Loaded ${this.player.extractors.size} extractors`);
		console.log(`🎵 Spotify → YouTube (yt-dlp), fallback: SoundCloud`);
	}
}
