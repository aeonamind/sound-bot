import { Client, ClientEvents, Events, Interaction } from 'discord.js';
import { CustomClient } from '../clients/custom-client';

module.exports = {
  name: Events.InteractionCreate as keyof ClientEvents,
  execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as CustomClient;
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      interaction.reply({ content: 'Outdated command' });
    }

    command.execute(interaction, client);
  },
};
