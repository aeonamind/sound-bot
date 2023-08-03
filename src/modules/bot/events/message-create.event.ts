import { Client, ClientEvents, Events, Message } from 'discord.js';
import {
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
} from '@discordjs/voice';
import { Logger } from '@nestjs/common';
const ytdl = require('ytdl-core');

const logger = new Logger('Bot');
const prefix = '!';

module.exports = {
  name: Events.MessageCreate as keyof ClientEvents,
  execute: async (message: Message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'play') {
      if (args.length === 0) {
        message.channel.send('Please provide a YouTube URL.');
        return;
      }

      const voiceChannel = message.member.voice.channel;

      if (!voiceChannel) {
        message.channel.send(
          'You need to be in a voice channel to use this command.',
        );
        return;
      }

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });
        const stream = ytdl(args[0], { filter: 'audioonly' });
        const resource = createAudioResource(stream, { inlineVolume: true });
        const player = createAudioPlayer({
          behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
        });

        player.play(resource);
        connection.subscribe(player);

        player.on('subscribe', () => {
          message.channel.send('Playing now: ' + args[0]);
        });

        player.on('error', (err) => {
          console.error(err);
          message.channel.send('Error occurred while playing the video.');
          connection.destroy();
        });

        player.on('unsubscribe', () => {
          connection.destroy();
        });
      } catch (err) {
        console.error(err);
        message.channel.send(
          'Error occurred while trying to join the voice channel.',
        );
      }
    }
  },
};
