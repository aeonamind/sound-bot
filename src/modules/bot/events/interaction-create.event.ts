import { Events, Interaction, Collection } from 'discord.js';
import { Logger } from '@nestjs/common';
import { BotEvent } from '../interfaces';
import { CustomClient } from '../clients/custom-client';

const logger = new Logger('InteractionEvent');

const event: BotEvent<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,

  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const client = interaction.client as CustomClient;
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return interaction.reply({
        content: 'This command is no longer available.',
        ephemeral: true,
      });
    }

    // Handle cooldowns
    if (command.cooldown) {
      const cooldownAmount = command.cooldown * 1000;

      if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Collection());
      }

      const timestamps = client.cooldowns.get(command.data.name)!;
      const now = Date.now();

      if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

        if (now < expirationTime) {
          const remainingTime = ((expirationTime - now) / 1000).toFixed(1);
          return interaction.reply({
            content: `Please wait ${remainingTime}s before using \`/${command.data.name}\` again.`,
            ephemeral: true,
          });
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      logger.error(`Error executing ${interaction.commandName}:`, error);

      const errorMessage = {
        content: 'An error occurred while executing this command.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};

export = event;
