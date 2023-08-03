import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, IntentsBitField } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

import { BotConfig } from '@core/configs/bot.config';
import { ConfigName } from '@core/constants/config-name.constant';
import { ReadyEvent } from './events/ready.event';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly client: Client;

  constructor(private readonly configService: ConfigService) {
    const intents = [
      IntentsBitField.Flags.Guilds,
      IntentsBitField.Flags.GuildMessages,
      IntentsBitField.Flags.MessageContent,
      IntentsBitField.Flags.GuildVoiceStates,
    ];

    this.client = new Client({ intents });
  }
  async onModuleInit() {
    await this.registerEvents();
    await this.start();
  }

  async start() {
    const token = this.configService.get<BotConfig>(ConfigName.Bot).token;
    await this.client.login(token);
  }

  private async registerEvents() {
    const eventFiles = fs
      .readdirSync(path.resolve(__dirname, 'events'))
      .filter((file) => file.endsWith('event.js'));

    for (const file of eventFiles) {
      const event = await import(path.resolve(__dirname, 'events', file));

      this.client.on(event.name, event.execute);
    }
  }
}
