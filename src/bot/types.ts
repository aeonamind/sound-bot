import type {
	ChatInputCommandInteraction,
	ClientEvents,
	SlashCommandBuilder,
	SlashCommandOptionsOnlyBuilder,
	SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { CustomClient } from "./client";

export type SlashCommandData =
	| SlashCommandBuilder
	| SlashCommandOptionsOnlyBuilder
	| SlashCommandSubcommandsOnlyBuilder
	| Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

export interface Command {
	data: SlashCommandData;
	cooldown?: number;
	execute: (
		interaction: ChatInputCommandInteraction,
		client: CustomClient,
	) => Promise<unknown> | unknown;
}

export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
	name: K;
	once?: boolean;
	execute: (...args: ClientEvents[K]) => Promise<unknown> | unknown;
}
