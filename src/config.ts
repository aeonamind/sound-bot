export interface BotConfig {
	token: string;
	clientId: string;
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	enabled: boolean;
}

export function getConfig(): BotConfig {
	return {
		token: process.env.BOT_TOKEN ?? "",
		clientId: process.env.CLIENT_ID ?? "",
		spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
		spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
		enabled: process.env.BOT_ENABLED === "true",
	};
}
