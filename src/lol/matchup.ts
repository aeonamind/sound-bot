import type { Timeline } from "./types";

/** Raw end-of-game numbers needed for lane comparisons. */
export interface LaneNumbers {
	puuid: string;
	name: string;
	championName: string;
	teamPosition: string;
	kills: number;
	deaths: number;
	assists: number;
	gold: number;
	cs: number;
	damage: number;
	damageShare: number;
	visionScore: number;
	level: number;
}

/** me − opponent (negative = behind). */
export interface LaneDiff {
	opponentName: string;
	opponentChamp: string;
	gold: number;
	cs: number;
	damage: number;
	level: number;
	vision: number;
	/** Damage dealt as a multiple of the opponent's (0.5 = half). */
	damageRatio: number;
	/** At 15:00, only when the timeline is available and the game lasted that long. */
	at15?: { gold: number; cs: number };
}

export const DIFF_MINUTE = 15;

export function computeLaneDiff(
	me: LaneNumbers,
	opp: LaneNumbers,
	timeline?: Timeline | null,
): LaneDiff {
	return {
		opponentName: opp.name,
		opponentChamp: opp.championName,
		gold: me.gold - opp.gold,
		cs: me.cs - opp.cs,
		damage: me.damage - opp.damage,
		level: me.level - opp.level,
		vision: me.visionScore - opp.visionScore,
		damageRatio: opp.damage > 0 ? me.damage / opp.damage : 1,
		at15: timeline
			? diffAtMinute(timeline, me.puuid, opp.puuid, DIFF_MINUTE)
			: undefined,
	};
}

function diffAtMinute(
	timeline: Timeline,
	mePuuid: string,
	oppPuuid: string,
	minute: number,
): { gold: number; cs: number } | undefined {
	const idOf = (puuid: string) =>
		timeline.info.participants.find((p) => p.puuid === puuid)?.participantId;
	const meId = idOf(mePuuid);
	const oppId = idOf(oppPuuid);
	const frame = timeline.info.frames.find(
		(f) => f.timestamp >= minute * 60_000,
	);
	const a = meId && frame?.participantFrames?.[String(meId)];
	const b = oppId && frame?.participantFrames?.[String(oppId)];
	if (!a || !b) return undefined;
	return {
		gold: a.totalGold - b.totalGold,
		cs:
			a.minionsKilled +
			a.jungleMinionsKilled -
			(b.minionsKilled + b.jungleMinionsKilled),
	};
}

/** 12345 → "12.345" (Vietnamese thousands separator). */
export function fmt(n: number): string {
	const s = String(Math.round(Math.abs(n))).replace(
		/\B(?=(\d{3})+(?!\d))/g,
		".",
	);
	return n < 0 ? `-${s}` : s;
}

const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

/** One-line summary for the embed, e.g. "Vàng -4.520 · Lính -86 · ...". */
export function describeDiff(d: LaneDiff): string {
	const lines = [
		`Vàng **${signed(d.gold)}** · Lính **${signed(d.cs)}** · Sát thương **${signed(d.damage)}**`,
		`Cấp **${signed(d.level)}** · Tầm nhìn **${signed(d.vision)}**`,
	];
	if (d.at15) {
		lines.push(
			`Phút ${DIFF_MINUTE}: vàng **${signed(d.at15.gold)}** · lính **${signed(d.at15.cs)}**`,
		);
	}
	return lines.join("\n");
}

interface Callout {
	/** Only the most severe callout per group is kept. */
	group: string;
	severity: number;
	text: string;
}

/**
 * Extra stat-based jabs for the gà, most severe first.
 * `diff` is absent when there's no lane opponent.
 */
export function statCallouts(
	p: LaneNumbers,
	diff?: LaneDiff,
	max = 2,
): string[] {
	const out: Callout[] = [];
	const opp = diff ? `${diff.opponentName} (${diff.opponentChamp})` : "";
	const kda = `${p.kills}/${p.deaths}/${p.assists}`;

	if (p.kills + p.assists === 0 && p.deaths >= 5) {
		out.push({
			group: "deaths",
			severity: 100 + p.deaths,
			text: `${kda}: ${p.name} vào trận chỉ để đi dạo và nộp mạng, không một mạng, không một hỗ trợ.`,
		});
	}
	if (p.deaths >= 10) {
		out.push({
			group: "deaths",
			severity: 80 + p.deaths,
			text: `${p.deaths} mạng dâng cho địch, ${p.name} một mình nuôi béo cả team bạn.`,
		});
	}
	if (diff && diff.gold <= -3000) {
		out.push({
			group: "gold",
			severity: 60 + Math.abs(diff.gold) / 500,
			text: `Kém ${opp} tận ${fmt(-diff.gold)} vàng, bằng nguyên một món huyền thoại.`,
		});
	}
	if (diff?.at15 && diff.at15.gold <= -2000) {
		out.push({
			group: "gold",
			severity: 58 + Math.abs(diff.at15.gold) / 500,
			text: `Mới phút ${DIFF_MINUTE} đã kém ${opp} ${fmt(-diff.at15.gold)} vàng, đi lane như đi chợ.`,
		});
	}
	if (diff && diff.cs <= -60 && p.teamPosition !== "UTILITY") {
		out.push({
			group: "cs",
			severity: 50 + Math.abs(diff.cs) / 10,
			text: `Thua ${opp} ${fmt(-diff.cs)} lính. Lính còn biết farm giỏi hơn ${p.name}.`,
		});
	}
	if (diff && diff.damageRatio <= 0.5 && diff.damage <= -5000) {
		out.push({
			group: "damage",
			severity: 48,
			text: `${opp} gây sát thương gấp ${(1 / Math.max(diff.damageRatio, 0.01)).toFixed(1)} lần ${p.name}. Đánh như gãi ngứa.`,
		});
	}
	if (p.damageShare < 0.1 && p.teamPosition !== "UTILITY") {
		out.push({
			group: "damage",
			severity: 45,
			text: `Gây có ${Math.round(p.damageShare * 100)}% sát thương của team, support còn đánh đau hơn.`,
		});
	}
	if (diff && diff.level <= -3) {
		out.push({
			group: "level",
			severity: 40,
			text: `Thấp hơn ${opp} ${-diff.level} cấp, như cho con nít đi đánh nhau với người lớn.`,
		});
	}

	const seen = new Set<string>();
	return out
		.sort((a, b) => b.severity - a.severity)
		.filter((c) => !seen.has(c.group) && seen.add(c.group))
		.slice(0, max)
		.map((c) => c.text);
}
