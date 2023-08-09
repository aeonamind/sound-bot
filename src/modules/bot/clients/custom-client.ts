import { Client, ClientOptions, Collection } from 'discord.js';

import { Command } from '../bot.service';
import { DisTube } from 'distube';
import { SpotifyPlugin } from '@distube/spotify';

export class CustomClient extends Client {
  public commands: Collection<string, Command>;
  public distube: DisTube;
  constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection<string, Command>();
    this.distube = new DisTube(this, {
      emitNewSongOnly: true,
      leaveOnFinish: true,
      emitAddSongWhenCreatingQueue: false,
      plugins: [new SpotifyPlugin()],
    });
  }
}
