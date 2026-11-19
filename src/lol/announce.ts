import { join } from "node:path";
import {
	AttachmentBuilder,
	EmbedBuilder,
	type Guild,
	type MessageCreateOptions,
} from "discord.js";
import { QueryType } from "discord-player";
import type { CustomClient } from "../bot/client";
import { createLogger } from "../logger";
import { describeDiff, statCallouts } from "./matchup";
import { gaRoast, mvpLine } from "./roasts";
import { type MatchReport, type PlayerScore, QUEUE_NAMES } from "./scoring";

const logger = createLogger("LolAnnounce");

const CLOWN_FILE = "goanhehy-clown.png";
const CLOWN_PATH = join(import.meta.dir, "../assets/images", CLOWN_FILE);
export const GA_SOUND_PATH = join(import.meta.dir, "../assets/sounds/ga.mp3");

const RANK_ICONS = ["🐔", "🐣", "🐥", "🐤", "🦅"];

function formatDuration(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function who(p: PlayerScore, discordIdByPuuid: Map<string, string>): string {
	const id = discordIdByPuuid.get(p.puuid);
	return id ? `<@${id}>` : `**${p.name}**`;
}

function kda(p: PlayerScore): string {
	return `${p.kills}/${p.deaths}/${p.assists}`;
}

function matchUrl(matchId: string): string {
	const [platform, id] = matchId.split("_");
	// leagueofgraphs uses region codes without the trailing digit: VN2 → vn, EUW1 → euw.
	const region = platform.replace(/\d+$/, "").toLowerCase();
	return `https://www.leagueofgraphs.com/match/${region}/${id}`;
}

export function buildReportMessage(
	report: MatchReport,
	discordIdByPuuid: Map<string, string>,
): MessageCreateOptions | null {
	const ga = report.ga;
	if (!ga) return null;

	const solo = report.group.length < 2;
	const queue = QUEUE_NAMES[report.queueId] ?? `Queue ${report.queueId}`;
	const result = ga.win ? "✅ Thắng" : "❌ Thua";

	const jabs = statCallouts(ga, ga.laneDiff).map((t) => `> 📉 ${t}`);

	const embed = new EmbedBuilder()
		.setColor(ga.win ? 0xf1c40f : 0xe74c3c)
		.setTitle(solo ? "🐔 Phiếu Chấm Gà" : "🐔 Vua Gà Trận Đấu")
		.setURL(matchUrl(report.matchId))
		.setDescription(
			`${who(ga, discordIdByPuuid)} — **${ga.championName}** \`${kda(ga)}\`\n` +
				`> ${gaRoast(ga)}\n` +
				(jabs.length ? `${jabs.join("\n")}\n` : "") +
				`\nĐiểm gà: **${ga.gaScore}**/100 · Hạng gà trong trận: **${ga.lobbyRank}/10**`,
		)
		.setImage(`attachment://${CLOWN_FILE}`)
		.setFooter({
			text: `${queue} · ${formatDuration(report.durationSec)} · ${result} · ID ${report.matchId}`,
		})
		.setTimestamp(report.endedAt);

	if (ga.laneDiff) {
		embed.addFields({
			name: `📉 Chênh lệch với ${ga.laneDiff.opponentName} (${ga.laneDiff.opponentChamp})`,
			value: describeDiff(ga.laneDiff),
		});
	}

	if (!solo) {
		const table = report.group
			.map((p, i) => {
				const icon =
					i === 0
						? "🐔"
						: i === report.group.length - 1
							? "🦅"
							: RANK_ICONS[Math.min(i, 3)];
				return `${icon} ${who(p, discordIdByPuuid)} · ${p.championName} \`${kda(p)}\` · **${p.gaScore}**`;
			})
			.join("\n");
		embed.addFields({ name: "Bảng xếp hạng gà", value: table });

		if (report.mvp) {
			embed.addFields({
				name: "🦅 MVP",
				value: `${who(report.mvp, discordIdByPuuid)} — ${mvpLine(report.mvp.name, report.mvp.championName)}`,
			});
		}

		if (report.titles.length) {
			const byPuuid = new Map(report.group.map((p) => [p.puuid, p]));
			embed.addFields({
				name: "Danh hiệu",
				value: report.titles
					.map((t) => {
						const p = byPuuid.get(t.puuid);
						return `${t.emoji} **${t.name}**: ${p ? who(p, discordIdByPuuid) : "?"} (${t.detail})`;
					})
					.join("\n"),
			});
		}
	}

	return {
		embeds: [embed],
		files: [new AttachmentBuilder(CLOWN_PATH, { name: CLOWN_FILE })],
	};
}

/**
 * Joins the gà's voice channel and plays the sad sound, but only if the bot
 * isn't already playing music in that guild.
 */
export async function playGaSound(
	client: CustomClient,
	guild: Guild,
	discordId: string,
): Promise<void> {
	try {
		const member = await guild.members.fetch(discordId).catch(() => null);
		const channel = member?.voice.channel;
		if (!channel) return;

		const queue = client.player.nodes.get(guild.id);
		if (queue && (queue.isPlaying() || queue.tracks.size > 0)) {
			logger.log(`Skip gà sound in ${guild.name}: music is playing`);
			return;
		}

		await client.player.play(channel, GA_SOUND_PATH, {
			searchEngine: QueryType.FILE,
			nodeOptions: {
				// No `channel` in metadata → player events stay silent in text chat.
				metadata: {},
				volume: 80,
				selfDeaf: true,
				leaveOnEnd: true,
				leaveOnEndCooldown: 2_000,
				leaveOnEmpty: true,
				leaveOnEmptyCooldown: 2_000,
			},
		});
	} catch (error) {
		logger.error(`Failed to play gà sound in ${guild.name}:`, error);
	}
}
