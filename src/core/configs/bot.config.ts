import { ConfigName } from "../constants/config-name.constant";

export const botConfig = () => ({
	[ConfigName.Bot]: {
		token: process.env.BOT_TOKEN,
		clientId: process.env.CLIENT_ID,
		spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
		spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
	},
});

export type BotConfig = ReturnType<typeof botConfig>[ConfigName.Bot];
