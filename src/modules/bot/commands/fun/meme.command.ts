import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import * as path from 'path';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Send a meme.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Meme type.')
        .setRequired(true)
        .addChoices({
          name: 'clown',
          value: 'clown',
        })
    ),

  execute(interaction: ChatInputCommandInteraction) {
    const options = interaction.options;
    const type = options.getString('type');

    switch (type) {
      case 'clown':
        const file = new AttachmentBuilder(
          path.resolve(
            __dirname,
            '../../../../assets/images/goanhehy-clown.png'
          )
        );
        const embed = new EmbedBuilder()
          .setTitle('Chú hề yêu em')
          .setImage('attachment://goanhehy-clown.png');

        interaction.reply({ embeds: [embed], files: [file] });
        break;
      default:
        return;
    }
  },
};
