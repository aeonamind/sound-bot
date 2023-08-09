import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Awaitable,
  ChatInputCommandInteraction,
  ClientEvents,
  IntentsBitField,
  Interaction,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

import { CustomClient as Client } from './clients/custom-client';
import { BotConfig } from '@core/configs/bot.config';
import { ConfigName } from '@core/constants/config-name.constant';
import { Queue } from 'distube';

type Event = {
  name: string;
  once: boolean;
  execute: (...args: ClientEvents[keyof ClientEvents]) => Awaitable<void>;
};

export type Command = {
  data: SlashCommandBuilder;
  execute: (interaction: Interaction, client: Client) => void;
};

@Injectable()
export class BotService implements OnModuleInit {
  private readonly client: Client;
  private readonly botConfig: BotConfig;
  private readonly logger: Logger;

  constructor(private readonly configService: ConfigService) {
    const intents = [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.MessageContent,
      IntentsBitField.Flags.GuildEmojisAndStickers,
      IntentsBitField.Flags.GuildIntegrations,
      IntentsBitField.Flags.GuildWebhooks,
      IntentsBitField.Flags.GuildInvites,
      IntentsBitField.Flags.GuildVoiceStates,
      IntentsBitField.Flags.GuildPresences,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.GuildMessageReactions,
      IntentsBitField.Flags.GuildMessageTyping,
      IntentsBitField.Flags.DirectMessages,
      IntentsBitField.Flags.DirectMessageReactions,
      IntentsBitField.Flags.DirectMessageTyping,
      IntentsBitField.Flags.MessageContent,
      IntentsBitField.Flags.GuildScheduledEvents,
      IntentsBitField.Flags.AutoModerationConfiguration,
      IntentsBitField.Flags.AutoModerationExecution,
    ];
    const partials = [
      Partials.Channel,
      Partials.GuildMember,
      Partials.Message,
      Partials.User,
      Partials.ThreadMember,
      Partials.Reaction,
      Partials.GuildScheduledEvent,
    ];

    this.client = new Client({ intents, partials });
    this.botConfig = this.configService.get<BotConfig>(ConfigName.Bot);
    this.logger = new Logger('Bot');
  }
  async onModuleInit() {
    await this.registerEvents();
    await this.registerCommands();
    await this.registerDistube();
    await this.start();
  }

  async start() {
    await this.client.login(this.botConfig.token);
  }

  private async registerEvents() {
    const eventFiles = fs
      .readdirSync(path.resolve(__dirname, 'events'))
      .filter((file) => file.endsWith('event.js'));

    for (const file of eventFiles) {
      const event: Event = await import(
        path.resolve(__dirname, 'events', file)
      );

      if (event.once) {
        this.client.once(event.name, event.execute);
      } else {
        this.client.on(event.name, event.execute);
      }
    }
  }

  private async registerCommands() {
    const commandsArray = [];
    const commandFolders = fs.readdirSync(path.resolve(__dirname, 'commands'));
    for (const folder of commandFolders) {
      const commandFiles = fs
        .readdirSync(path.resolve(__dirname, 'commands', folder))
        .filter((file) => file.endsWith('command.js'));

      for (const file of commandFiles) {
        const command: Command = await import(
          path.resolve(__dirname, 'commands', folder, file)
        );

        this.client.commands.set(command.data.name, command);
        commandsArray.push(command.data.toJSON());
      }
    }

    const rest = new REST().setToken(this.botConfig.token);

    (async () => {
      try {
        const data = (await rest.put(
          Routes.applicationCommands(this.botConfig.clientId),
          {
            body: commandsArray,
          }
        )) as Array<object>;

        this.logger.log(
          `Successfully reloaded ${data.length} application (/) commands.`
        );
      } catch (error) {
        this.logger.error(error);
      }
    })();
  }

  private async registerDistube() {
    const status = (queue: Queue) =>
      `Volume: \`${queue.volume}%\` | Filter: \`${
        queue.filters.names.join(', ') || 'Off'
      }\` | Loop: \`${
        queue.repeatMode
          ? queue.repeatMode === 2
            ? 'All Queue'
            : 'This Song'
          : 'Off'
      }\` | Autoplay: \`${queue.autoplay ? 'On' : 'Off'}\``;
    this.client.distube
      .on('playSong', (queue, song) =>
        queue.textChannel.send(
          `Playing \`${song.name}\` - \`${
            song.formattedDuration
          }\`\nRequested by: ${song.user}\n${status(queue)}`
        )
      )
      .on('addSong', (queue, song) =>
        queue.textChannel.send(
          `Added ${song.name} - \`${song.formattedDuration}\` to the queue by ${song.user}`
        )
      )
      .on('addList', (queue, playlist) =>
        queue.textChannel.send(
          `Added \`${playlist.name}\` playlist (${
            playlist.songs.length
          } songs) to queue\n${status(queue)}`
        )
      )
      .on('error', (channel, e) => {
        if (channel)
          channel.send(`An error encountered: ${e.toString().slice(0, 1974)}`);
        else console.error(e);
      })
      .on('empty', (channel) =>
        // @ts-ignore
        channel.send('Voice channel is empty! Leaving the channel...')
      )
      .on('searchNoResult', (message, query) =>
        message.channel.send(`No result found for \`${query}\`!`)
      )
      .on('finish', (queue) => queue.textChannel.send('Finished!'));
  }
}
