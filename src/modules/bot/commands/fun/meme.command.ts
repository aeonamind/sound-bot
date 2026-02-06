import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import * as path from 'path';
import { Command } from '../../interfaces';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Send a meme')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Meme type')
        .setRequired(true)
        .addChoices({ name: 'clown', value: 'clown' }),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const type = interaction.options.getString('type', true);

    switch (type) {
      case 'clown': {
        const imagePath = path.resolve(
          __dirname,
          '../../../../assets/images/goanhehy-clown.png',
        );
        const file = new AttachmentBuilder(imagePath);
        const embed = new EmbedBuilder()
          .setTitle('Chú hề yêu em')
          .setImage('attachment://goanhehy-clown.png');

        await interaction.reply({ embeds: [embed], files: [file] });
        break;
      }
      default:
        await interaction.reply({
          content: 'Unknown meme type',
          ephemeral: true,
        });
    }
  },
};

export = command;
