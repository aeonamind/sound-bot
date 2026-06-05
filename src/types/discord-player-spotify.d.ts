declare module "discord-player-spotify" {
	import type { BaseExtractor } from "discord-player";

	export interface SpotifyExtractorInit {
		clientId?: string;
		clientSecret?: string;
		market?: string | null;
	}

	export class SpotifyExtractor extends BaseExtractor<SpotifyExtractorInit> {
		static identifier: string;
	}
}
