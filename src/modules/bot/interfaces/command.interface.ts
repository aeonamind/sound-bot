import type {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { CustomClient } from "../clients/custom-client";

export type SlashCommandData =
	| SlashCommandBuilder
	| SlashCommandOptionsOnlyBuilder
	| SlashCommandSubcommandsOnlyBuilder
	| Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface Command {
	/** The slash command data */
	data: SlashCommandData;
	/** Optional cooldown in seconds */
	cooldown?: number;
	/** Execute the command */
	execute: (
		interaction: ChatInputCommandInteraction,
		client: CustomClient,
	) => Promise<unknown> | unknown;
}
