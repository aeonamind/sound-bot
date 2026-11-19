export interface BotConfig {
	token: string;
	clientId: string;
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	enabled: boolean;
	lol: LolConfig;
}

export interface LolConfig {
	riotApiKey?: string;
	databaseUrl?: string;
	accountRegion: string;
	matchRegion: string;
	pollIntervalSec: number;
}

export function getConfig(): BotConfig {
	return {
		token: process.env.BOT_TOKEN ?? "",
		clientId: process.env.CLIENT_ID ?? "",
		spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
		spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
		enabled: process.env.BOT_ENABLED === "true",
		lol: {
			riotApiKey: process.env.RIOT_API_KEY || undefined,
			databaseUrl: process.env.DATABASE_URL || undefined,
			accountRegion: process.env.LOL_ACCOUNT_REGION || "asia",
			matchRegion: process.env.LOL_MATCH_REGION || "sea",
			pollIntervalSec: Math.max(
				30,
				Number(process.env.LOL_POLL_INTERVAL_SEC) || 90,
			),
		},
	};
}
