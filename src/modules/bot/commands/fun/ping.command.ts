import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../interfaces';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.reply({
      content: `Pong! Latency: \`${latency}ms\` | API: \`${apiLatency}ms\``,
      ephemeral: true,
    });
  },
};

export = command;
