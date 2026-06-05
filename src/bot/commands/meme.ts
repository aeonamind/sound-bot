import { join } from "node:path";
import {
	AttachmentBuilder,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("meme")
		.setDescription("Send a meme")
		.addStringOption((option) =>
			option
				.setName("type")
				.setDescription("Meme type")
				.setRequired(true)
				.addChoices({ name: "clown", value: "clown" }),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const type = interaction.options.getString("type", true);

		switch (type) {
			case "clown": {
				const imagePath = join(
					import.meta.dir,
					"../../assets/images/goanhehy-clown.png",
				);
				const file = new AttachmentBuilder(imagePath);
				const embed = new EmbedBuilder()
					.setTitle("Chú hề yêu em")
					.setImage("attachment://goanhehy-clown.png");

				await interaction.reply({ embeds: [embed], files: [file] });
				break;
			}
			default:
				await interaction.reply({
					content: "Unknown meme type",
					ephemeral: true,
				});
		}
	},
};

export default command;
