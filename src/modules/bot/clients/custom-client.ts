import { Client, ClientOptions, Collection } from 'discord.js';

import { Command } from '../bot.service';

export class CustomClient extends Client {
  public commands: Collection<string, Command>;
  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection<string, Command>();
  }
}
