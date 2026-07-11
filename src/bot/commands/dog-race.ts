import {
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";

const RACE_DURATION_MS = 10_000;
const UPDATE_INTERVAL_MS = 400;
const TRACK_WIDTH = 24;
const SPRITE_WIDTH = 1;
const FINISH_LINE = TRACK_WIDTH - SPRITE_WIDTH;
const DOG_ICON = "🐶";
const MIN_DOGS = 2;
const MAX_DOGS = 10;
const MAX_NAME_WIDTH = 14;

const MIN_VELOCITY = 0.5;
const MAX_VELOCITY = 6;
const MAX_ACCEL = 5;
const BOOST_ACCEL = 1.2;
const SLOW_ACCEL = -1.2;
const FAST_VELOCITY = 3.5;

const BOOST_TRAILS = ["💨»", "»💨", "💨💨", "»»"] as const;
const FAST_TRAILS = ["»", "·", "»", "·"] as const;
const SLOW_TRAILS = ["…", "·", "…", "▪"] as const;

interface DogRunner {
	name: string;
	position: number;
	velocity: number;
	acceleration: number;
	finishedAt: number | null;
}

function parseDogNames(input: string): string[] {
	return input
		.split(",")
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
}

function createRunners(names: string[]): DogRunner[] {
	return names.map((name) => ({
		name,
		position: 0,
		velocity: 1.8 + Math.random() * 0.4,
		acceleration: 0,
		finishedAt: null,
	}));
}

function stepRunners(
	runners: DogRunner[],
	dtSec: number,
	elapsedSec: number,
): void {
	for (const runner of runners) {
		if (runner.finishedAt !== null) continue;

		const accel = (Math.random() - 0.5) * 2 * MAX_ACCEL;
		runner.acceleration = accel;
		runner.velocity = Math.min(
			MAX_VELOCITY,
			Math.max(MIN_VELOCITY, runner.velocity + accel * dtSec),
		);

		const nextPosition = runner.position + runner.velocity * dtSec;

		if (nextPosition >= FINISH_LINE) {
			const overflow = nextPosition - FINISH_LINE;
			runner.finishedAt = elapsedSec - overflow / runner.velocity;
			runner.position = FINISH_LINE;
			continue;
		}

		runner.position = nextPosition;
	}
}

function getNameWidth(runners: DogRunner[]): number {
	const longest = Math.max(...runners.map((runner) => runner.name.length), 4);
	return Math.min(longest, MAX_NAME_WIDTH);
}

function padName(name: string, width: number): string {
	if (name.length > width) {
		return `${name.slice(0, width - 1)}…`;
	}
	return name.padEnd(width);
}

function getSpeedTrail(runner: DogRunner, frame: number): string {
	if (runner.finishedAt !== null) return "";

	if (runner.acceleration >= BOOST_ACCEL) {
		return BOOST_TRAILS[frame % BOOST_TRAILS.length];
	}
	if (runner.acceleration <= SLOW_ACCEL) {
		return SLOW_TRAILS[frame % SLOW_TRAILS.length];
	}
	if (runner.velocity >= FAST_VELOCITY) {
		return FAST_TRAILS[frame % FAST_TRAILS.length];
	}
	return "";
}

function renderTrackLine(
	progress: number,
	finished: boolean,
	trail: string,
): string {
	// Start on the left, finish 🏁 on the right
	const trailWidth = trail.length;
	const dogPos = Math.floor(progress);
	const completed = "▓".repeat(Math.max(0, dogPos - trailWidth));
	const remaining = "░".repeat(
		Math.max(0, TRACK_WIDTH - dogPos - SPRITE_WIDTH - trailWidth),
	);
	const end = finished ? "╣" : "╢";

	return `╠${completed}${trail}${DOG_ICON}${remaining}${end}🏁`;
}

function renderTrack(
	runner: DogRunner,
	nameWidth: number,
	frame: number,
): string {
	const finished = runner.finishedAt !== null;
	const trail = getSpeedTrail(runner, frame);
	const line = renderTrackLine(runner.position, finished, trail);
	return `${padName(runner.name, nameWidth)} ${line}`;
}

function renderRaceFrame(
	runners: DogRunner[],
	elapsedMs: number,
	frame: number,
): string {
	const nameWidth = getNameWidth(runners);
	const remainingSec = Math.max(0, (RACE_DURATION_MS - elapsedMs) / 1000);
	const header =
		elapsedMs >= RACE_DURATION_MS
			? "🏁 **DOG RACE — FINISH!** 🏁"
			: `🏁 **DOG RACE** 🏁\n⏱️ ${remainingSec.toFixed(1)}s remaining`;

	const lines = runners.map((runner) => renderTrack(runner, nameWidth, frame));

	return `${header}\n\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

function renderRanking(runners: DogRunner[]): string {
	const raceDurationSec = RACE_DURATION_MS / 1000;
	const ranked = [...runners].sort((a, b) => {
		const aFinished = a.finishedAt !== null;
		const bFinished = b.finishedAt !== null;

		if (aFinished && bFinished) return a.finishedAt! - b.finishedAt!;
		if (aFinished) return -1;
		if (bFinished) return 1;
		return b.position - a.position;
	});

	const medals = ["🥇", "🥈", "🥉"];
	const lines = ranked.map((runner, index) => {
		const medal = medals[index] ?? `${index + 1}.`;
		const time =
			runner.finishedAt !== null && runner.finishedAt <= raceDurationSec
				? `${runner.finishedAt.toFixed(2)}s`
				: "DNF";
		return `${medal} **${runner.name}** — ${time}`;
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

		const runners = createRunners(names);

		await interaction.deferReply();

		const startTime = Date.now();
		let elapsedMs = 0;
		let simTimeSec = 0;
		let frame = 0;
		const dtSec = UPDATE_INTERVAL_MS / 1000;

		while (elapsedMs < RACE_DURATION_MS) {
			await interaction.editReply({
				content: renderRaceFrame(runners, elapsedMs, frame),
			});

			await sleep(UPDATE_INTERVAL_MS);
			simTimeSec += dtSec;
			stepRunners(runners, dtSec, simTimeSec);
			elapsedMs = Date.now() - startTime;
			frame++;
		}

		await interaction.editReply({
			content: `${renderRaceFrame(runners, RACE_DURATION_MS, frame)}\n\n${renderRanking(runners)}`,
		});
	},
};

export default command;
