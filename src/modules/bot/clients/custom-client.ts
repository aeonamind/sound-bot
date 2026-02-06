import { Client, ClientOptions, Collection } from 'discord.js';
import { Player } from 'discord-player';
import { SpotifyExtractor } from 'discord-player-spotify';
import { SoundcloudExtractor } from 'discord-player-soundcloud';
import { Command } from '../interfaces';
import { DefaultExtractors } from '@discord-player/extractor';

export class CustomClient extends Client {
  /** Collection of registered slash commands */
  public readonly commands = new Collection<string, Command>();

  /** Collection of command cooldowns */
  public readonly cooldowns = new Collection<string, Collection<string, number>>();

  /** Discord Player instance for music playback */
  public readonly player: Player;

  constructor(options: ClientOptions) {
    super(options);

    // Initialize the player
    this.player = new Player(this);
  }

  /**
   * Initialize the player with extractors
   */
  async initPlayer(): Promise<void> {
    await this.player.extractors.register(SoundcloudExtractor, {});
    await this.player.extractors.register(SpotifyExtractor, {});
  }
}
