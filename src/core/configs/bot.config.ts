import { ConfigName } from '../constants/config-name.constant';

export const botConfig = () => ({
  [ConfigName.Bot]: {
    token: process.env.BOT_TOKEN,
  },
});

export type BotConfig = ReturnType<typeof botConfig>[ConfigName.Bot];
