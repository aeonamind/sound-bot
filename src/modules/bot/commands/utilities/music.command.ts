import {
  ChatInputCommandInteraction,
  CommandInteractionOptionResolver,
  EmbedBuilder,
  GuildMember,
  Interaction,
  SlashCommandBuilder,
} from 'discord.js';
import { CustomClient } from '../../clients/custom-client';
import { Song } from 'distube';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music system.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Play a song.')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('Provide the name or url for the song.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('volume')
        .setDescription('Adjust the song volume.')
        .addNumberOption((option) =>
          option
            .setName('percent')
            .setDescription('10 = 10%')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('settings')
        .setDescription('Select an option.')
        .addStringOption((option) =>
          option
            .setName('options')
            .setDescription('Select an option.')
            .setRequired(true)
            .addChoices(
              { name: 'queue', value: 'queue' },
              { name: 'skip', value: 'skip' },
              { name: 'pause', value: 'pause' },
              { name: 'resume', value: 'resume' },
              { name: 'stop', value: 'stop' }
            )
        )
    ),
  async execute(
    interaction: Interaction & {
      options: Omit<
        CommandInteractionOptionResolver,
        'getMessage' | 'getFocused'
      >;
      member: GuildMember;
    },
    client: CustomClient
  ) {
    const { options, member, guild, channel } = interaction;

    const subcommand = options.getSubcommand();
    const query = options.getString('query');
    const volume = options.getNumber('percent');
    const option = options.getString('options');
    const voiceChannel = member.voice.channel;

    const embed = new EmbedBuilder();

    if (!voiceChannel) {
      embed
        .setColor('Red')
        .setDescription(
          'You must be in a voice channel to execute music commands.'
        );
      if ('reply' in interaction)
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // if (member.voice.channelId == guild.members.me.voice.channelId) {
    //   embed
    //     .setColor('Red')
    //     .setDescription(
    //       `You can't use the music player as it is already active in <#${guild.members.me.voice.channelId}>.`
    //     );
    //   if ('reply' in interaction)
    //     return interaction.reply({ embeds: [embed], ephemeral: true });
    // }

    try {
      switch (subcommand) {
        case 'play':
          client.distube.play(voiceChannel, query, {
            textChannel: channel,
            member: member,
          });
          if ('reply' in interaction)
            return interaction.reply({ content: '🫰 Request received.' });

        case 'volume':
          client.distube.setVolume(voiceChannel, volume);
          if ('reply' in interaction)
            return interaction.reply({
              content: `🔉 Volume has been set to ${volume}.`,
            });

        case 'settings':
          const queue = client.distube.getQueue(voiceChannel);

          if (!queue) {
            embed.setColor('Red').setDescription('There is no active queue.');
            if ('reply' in interaction)
              return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          switch (option) {
            case 'skip':
              await queue.skip();
              embed
                .setColor('Blue')
                .setDescription('⏭️ The song has been skipped.');
              if ('reply' in interaction)
                return interaction.reply({ embeds: [embed], ephemeral: true });

            case 'stop':
              await queue.stop();
              embed
                .setColor('DarkRed')
                .setDescription('⏹️ The song has been stopped.');
              if ('reply' in interaction)
                return interaction.reply({ embeds: [embed], ephemeral: true });

            case 'pause':
              queue.pause();
              embed
                .setColor('Orange')
                .setDescription('⏸️ The song has been paused.');
              if ('reply' in interaction)
                return interaction.reply({ embeds: [embed], ephemeral: true });

            case 'resume':
              queue.resume();
              embed
                .setColor('Green')
                .setDescription('▶️ The song has been resumed.');
              if ('reply' in interaction)
                return interaction.reply({ embeds: [embed], ephemeral: true });

            case 'queue':
              embed
                .setColor('Purple')
                .setDescription(
                  `${queue.songs.map(
                    (song: Song, index: number) =>
                      `\n**${index + 1}.** ${song.name} - \'${
                        song.formattedDuration
                      }\'`
                  )}`
                );
              if ('reply' in interaction)
                return interaction.reply({ embeds: [embed], ephemeral: true });
          }
      }
    } catch (error) {
      console.log(error);

      embed.setColor('Red').setDescription('🚫 Something went wrong!');
      if ('reply' in interaction)
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
