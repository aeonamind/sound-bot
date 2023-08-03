import { Client, ClientEvents, Events } from 'discord.js';
import { Logger } from '@nestjs/common';

const logger = new Logger('Bot');

const readyEvent = {
  name: Events.ClientReady as keyof ClientEvents,
  once: true,
  execute(client: Client) {
    logger.log(`Logged in as ${client.user?.tag}`);
  },
};

export type ReadyEvent = typeof readyEvent;

module.exports = readyEvent;
