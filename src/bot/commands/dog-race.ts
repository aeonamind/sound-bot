import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";

const RACE_DURATION_MS = 10_000;
const UPDATE_INTERVAL_MS = 1_000;
const TRACK_WIDTH = 24;
const MIN_DOGS = 2;
const MAX_DOGS = 10;

interface Dog {
	name: string;
	velocity: number;
}

function parseDogNames(input: string): string[] {
	return input
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
}

function createDogs(names: string[]): Dog[] {
	return names.map((name) => ({
		name,
		velocity: 2.0 + Math.random() * 3.0,
	}));
}

function getFinishTime(dog: Dog): number {
	return TRACK_WIDTH / dog.velocity;
}

function getPosition(dog: Dog, elapsedMs: number): number {
	const elapsedSec = elapsedMs / 1000;
	return Math.min(TRACK_WIDTH, Math.floor(dog.velocity * elapsedSec));
}

function renderTrack(dog: Dog, position: number): string {
	const track =
		"·".repeat(position) +
		"🐕" +
		"·".repeat(Math.max(0, TRACK_WIDTH - position));
	return `🐕 **${dog.name}**  ${track}`;
}

function renderRaceFrame(dogs: Dog[], elapsedMs: number): string {
	const remainingSec = Math.ceil((RACE_DURATION_MS - elapsedMs) / 1000);
	const header =
		elapsedMs >= RACE_DURATION_MS
			? "🏁 **DOG RACE — FINISH!** 🏁"
			: `🏁 **DOG RACE** 🏁\n⏱️ ${remainingSec}s remaining`;

	const lines = dogs.map((dog) => {
		const position = getPosition(dog, elapsedMs);
		return renderTrack(dog, position);
	});

	return `${header}\n\n${lines.join("\n")}`;
}

function renderRanking(dogs: Dog[]): string {
	const raceDurationSec = RACE_DURATION_MS / 1000;
	const ranked = [...dogs].sort((a, b) => {
		const finishA = getFinishTime(a);
		const finishB = getFinishTime(b);
		const aFinished = finishA <= raceDurationSec;
		const bFinished = finishB <= raceDurationSec;

		if (aFinished && bFinished) return finishA - finishB;
		if (aFinished) return -1;
		if (bFinished) return 1;
		return getPosition(b, RACE_DURATION_MS) - getPosition(a, RACE_DURATION_MS);
	});

	const medals = ["🥇", "🥈", "🥉"];
	const lines = ranked.map((dog, index) => {
		const finishTime = getFinishTime(dog);
		const medal = medals[index] ?? `${index + 1}.`;
		const time =
			finishTime <= raceDurationSec ? `${finishTime.toFixed(2)}s` : "DNF";
		return `${medal} **${dog.name}** — ${time}`;
	});

	return `🏆 **RACE RESULTS** 🏆\n\n${lines.join("\n")}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("dog-race")
		.setDescription("Race dogs and see who wins!")
		.addStringOption((option) =>
			option
				.setName("dogs")
				.setDescription("Dog names separated by commas (e.g. Buddy, Max, Rex)")
				.setRequired(true),
		),

	cooldown: 15,

	async execute(interaction: ChatInputCommandInteraction) {
		const rawNames = interaction.options.getString("dogs", true);
		const names = parseDogNames(rawNames);

		if (names.length < MIN_DOGS) {
			return interaction.reply({
				content: `Please provide at least ${MIN_DOGS} dog names separated by commas.`,
				ephemeral: true,
			});
		}

		if (names.length > MAX_DOGS) {
			return interaction.reply({
				content: `Maximum ${MAX_DOGS} dogs allowed per race.`,
				ephemeral: true,
			});
		}

		const uniqueNames = new Set(names.map((name) => name.toLowerCase()));
		if (uniqueNames.size !== names.length) {
			return interaction.reply({
				content: "Each dog must have a unique name.",
				ephemeral: true,
			});
		}

		const dogs = createDogs(names);

		await interaction.deferReply();

		const startTime = Date.now();
		let elapsedMs = 0;

		while (elapsedMs < RACE_DURATION_MS) {
			await interaction.editReply({
				content: renderRaceFrame(dogs, elapsedMs),
			});

			await sleep(UPDATE_INTERVAL_MS);
			elapsedMs = Date.now() - startTime;
		}

		await interaction.editReply({
			content: `${renderRaceFrame(dogs, RACE_DURATION_MS)}\n\n${renderRanking(dogs)}`,
		});
	},
};

export default command;
