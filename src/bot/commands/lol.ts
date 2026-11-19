import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { buildReportMessage } from "../../lol/announce";
import { normalizeMatchId, parseRiotId } from "../../lol/riot-client";
import { checkScorable } from "../../lol/scoring";
import { getLolService, type LolService } from "../../lol/service";
import type { Match } from "../../lol/types";
import type { Command } from "../types";

const PERIODS: Record<string, { label: string; days: number | null }> = {
	week: { label: "7 ngày qua", days: 7 },
	month: { label: "30 ngày qua", days: 30 },
	all: { label: "mọi thời đại", days: null },
};

const command: Command = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName("lol")
		.setDescription("Liên Minh Huyền Thoại: chấm điểm con gà sau mỗi trận")
		.addSubcommand((s) =>
			s
				.setName("link")
				.setDescription("Liên kết tài khoản Riot của bạn")
				.addStringOption((o) =>
					o
						.setName("riot_id")
						.setDescription("Riot ID dạng Tên#TAG")
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s.setName("unlink").setDescription("Huỷ liên kết tài khoản Riot"),
		)
		.addSubcommand((s) =>
			s
				.setName("channel")
				.setDescription(
					"Đặt kênh này làm kênh đăng kết quả (cần quyền Manage Server)",
				),
		)
		.addSubcommand((s) =>
			s
				.setName("last")
				.setDescription("Chấm điểm trận gần nhất ngay bây giờ")
				.addUserOption((o) =>
					o.setName("user").setDescription("Người cần soi (mặc định: bạn)"),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("match")
				.setDescription("Soi một trận cụ thể theo ID")
				.addStringOption((o) =>
					o
						.setName("id")
						.setDescription(
							"ID trận: 1234567890, VN2_1234567890 hoặc link leagueofgraphs",
						)
						.setRequired(true),
				),
		)
		.addSubcommand((s) =>
			s
				.setName("leaderboard")
				.setDescription("Bảng xếp hạng gà")
				.addStringOption((o) =>
					o
						.setName("period")
						.setDescription("Khoảng thời gian")
						.addChoices(
							{ name: "Tuần", value: "week" },
							{ name: "Tháng", value: "month" },
							{ name: "Tất cả", value: "all" },
						),
				),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) {
			return interaction.reply({
				content: "Lệnh này chỉ dùng trong server.",
				flags: MessageFlags.Ephemeral,
			});
		}

		const lol = getLolService();
		if (!lol) {
			return interaction.reply({
				content:
					"Tính năng LMHT chưa được cấu hình (thiếu RIOT_API_KEY / DATABASE_URL).",
				flags: MessageFlags.Ephemeral,
			});
		}

		switch (interaction.options.getSubcommand()) {
			case "link":
				return link(interaction, lol);
			case "unlink":
				return unlink(interaction, lol);
			case "channel":
				return setChannel(interaction, lol);
			case "last":
				return last(interaction, lol);
			case "match":
				return matchById(interaction, lol);
			case "leaderboard":
				return leaderboard(interaction, lol);
		}
	},
};

async function link(interaction: ChatInputCommandInteraction, lol: LolService) {
	const raw = interaction.options.getString("riot_id", true);
	const parsed = parseRiotId(raw);
	if (!parsed) {
		return interaction.reply({
			content:
				"Riot ID không hợp lệ, phải có dạng `Tên#TAG` (ví dụ `Faker#KR1`).",
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const account = await lol.riot.getAccountByRiotId(
		parsed.gameName,
		parsed.tagLine,
	);
	if (!account) {
		return interaction.editReply(`Không tìm thấy tài khoản **${raw}**.`);
	}

	// Baseline: the current latest match is never announced.
	const [latest] = await lol.riot.getMatchIds(account.puuid, 1);
	const riotId = `${account.gameName}#${account.tagLine}`;
	await lol.db.linkAccount({
		guildId: interaction.guildId!,
		discordId: interaction.user.id,
		puuid: account.puuid,
		riotId,
		lastMatchId: latest ?? null,
	});

	const channelId = await lol.db.getChannel(interaction.guildId!);
	const hint = channelId
		? `Kết quả sẽ được đăng ở <#${channelId}>.`
		: "⚠️ Server chưa có kênh đăng kết quả, nhờ admin chạy `/lol channel`.";
	return interaction.editReply(
		`✅ Đã liên kết **${riotId}**. Từ trận sau bot sẽ chấm điểm gà cho bạn.\n${hint}`,
	);
}

async function unlink(
	interaction: ChatInputCommandInteraction,
	lol: LolService,
) {
	const removed = await lol.db.unlinkAccount(
		interaction.guildId!,
		interaction.user.id,
	);
	return interaction.reply({
		content: removed
			? "Đã huỷ liên kết. Trốn được rồi đấy 🐔"
			: "Bạn chưa liên kết tài khoản nào.",
		flags: MessageFlags.Ephemeral,
	});
}

async function setChannel(
	interaction: ChatInputCommandInteraction,
	lol: LolService,
) {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		return interaction.reply({
			content: "Bạn cần quyền **Manage Server** để đặt kênh.",
			flags: MessageFlags.Ephemeral,
		});
	}
	await lol.db.setChannel(interaction.guildId!, interaction.channelId);
	return interaction.reply(
		`📢 Kết quả chấm gà sẽ được đăng ở <#${interaction.channelId}>.`,
	);
}

async function last(interaction: ChatInputCommandInteraction, lol: LolService) {
	const user = interaction.options.getUser("user") ?? interaction.user;
	const account = await lol.db.getAccount(interaction.guildId!, user.id);
	if (!account) {
		return interaction.reply({
			content: `${user} chưa liên kết tài khoản. Dùng \`/lol link\` trước nhé.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.deferReply();
	const [matchId] = await lol.riot.getMatchIds(account.puuid, 1);
	const match = matchId ? await lol.riot.getMatch(matchId) : null;
	if (!match) {
		return interaction.editReply(
			`Không tìm thấy trận nào của **${account.riotId}**.`,
		);
	}

	return replyWithReport(
		interaction,
		lol,
		match,
		`Trận gần nhất của **${account.riotId}**`,
		false,
	);
}

async function matchById(
	interaction: ChatInputCommandInteraction,
	lol: LolService,
) {
	const raw = interaction.options.getString("id", true);
	const matchId = normalizeMatchId(raw, lol.riot.platform);
	if (!matchId) {
		return interaction.reply({
			content: `ID trận không hợp lệ: \`${raw}\`. Ví dụ: \`1234567890\`, \`${lol.riot.platform}_1234567890\`.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.deferReply();
	const match = await lol.riot.getMatch(matchId);
	if (!match) {
		return interaction.editReply(
			`Không tìm thấy trận \`${matchId}\`. Kiểm tra lại ID hoặc server (đang dùng ${lol.riot.platform}).`,
		);
	}
	return replyWithReport(interaction, lol, match, `Trận \`${matchId}\``, true);
}

/**
 * Scores a match for an on-demand command. Linked members of this server form
 * the group; if none played (and `wholeLobbyIfNoMembers`), all 10 players are ranked.
 */
async function replyWithReport(
	interaction: ChatInputCommandInteraction,
	lol: LolService,
	match: Match,
	label: string,
	wholeLobbyIfNoMembers: boolean,
) {
	const scorable = checkScorable(match);
	if (!scorable.ok) {
		return interaction.editReply(
			`${label} không chấm được (${scorable.reason}). Chỉ chấm trận Summoner's Rift dài trên 5 phút.`,
		);
	}

	const inMatch = new Set(match.metadata.participants);
	const members = (await lol.db.listAccounts(interaction.guildId!)).filter(
		(a) => inMatch.has(a.puuid),
	);

	const timeline = await lol.fetchTimeline(match.metadata.matchId);
	const { report, discordIdByPuuid } = lol.buildReport(
		match,
		members,
		timeline,
		wholeLobbyIfNoMembers,
	);

	const message = buildReportMessage(report, discordIdByPuuid);
	if (!message) {
		return interaction.editReply("Không dựng được báo cáo cho trận này.");
	}
	return interaction.editReply({
		embeds: message.embeds,
		files: message.files,
		// On-demand lookups shouldn't ping people.
		allowedMentions: { users: [] },
	});
}

async function leaderboard(
	interaction: ChatInputCommandInteraction,
	lol: LolService,
) {
	const key = interaction.options.getString("period") ?? "week";
	const period = PERIODS[key] ?? PERIODS.week;
	const since = period.days
		? new Date(Date.now() - period.days * 86_400_000)
		: null;

	const rows = await lol.db.leaderboard(interaction.guildId!, since);
	if (rows.length === 0) {
		return interaction.reply(
			`Chưa có trận nào được chấm trong ${period.label}.`,
		);
	}

	const lines = rows.map(
		(r, i) =>
			`**${i + 1}.** <@${r.discordId}> — 🐔 ${r.gaCount} lần gà · 🦅 ${r.mvpCount} MVP · ${r.games} trận · điểm gà TB **${r.avgGaScore.toFixed(1)}**`,
	);
	const embed = new EmbedBuilder()
		.setColor(0xf1c40f)
		.setTitle(`🐔 Bảng Phong Thần Gà (${period.label})`)
		.setDescription(lines.join("\n"));
	return interaction.reply({ embeds: [embed], allowedMentions: { users: [] } });
}

export default command;
