import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('pong')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute(interaction: ChatInputCommandInteraction) {
    interaction.reply({
      content: `${Date.now() - interaction.createdTimestamp}ms`,
      ephemeral: true,
    });
  },
};
