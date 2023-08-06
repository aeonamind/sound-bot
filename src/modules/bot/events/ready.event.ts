import { Client, ClientEvents, Events } from 'discord.js';
import { Logger } from '@nestjs/common';

const logger = new Logger('Bot');

module.exports = {
  name: Events.ClientReady as keyof ClientEvents,
  once: true,
  execute(client: Client) {
    logger.log(`Logged in as ${client.user?.tag}`);
  },
};
