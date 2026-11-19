import type { Match, Participant, TeamPosition } from "./types";

/** Summoner's Rift queues we judge: draft, ranked solo/flex, blind, swiftplay, quickplay, clash. */
export const SCORABLE_QUEUES = new Set([400, 420, 430, 440, 480, 490, 700]);
const SUMMONERS_RIFT = 11;
const MIN_DURATION_SEC = 5 * 60;

export const QUEUE_NAMES: Record<number, string> = {
	400: "Thường (Cấm chọn)",
	420: "Xếp hạng Đơn/Đôi",
	430: "Thường (Chọn ẩn)",
	440: "Xếp hạng Linh hoạt",
	480: "Swiftplay",
	490: "Quickplay",
	700: "Clash",
};

type MetricKey =
	| "deaths"
	| "kda"
	| "damageShare"
	| "killParticipation"
	| "csPerMin"
	| "visionPerMin"
	| "deadRatio";

type Weights = Record<MetricKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
	deaths: 0.25,
	kda: 0.2,
	damageShare: 0.15,
	killParticipation: 0.15,
	csPerMin: 0.1,
	visionPerMin: 0.1,
	deadRatio: 0.05,
};

/** Supports aren't judged on CS; that weight moves to vision and kill participation. */
export const SUPPORT_WEIGHTS: Weights = {
	...DEFAULT_WEIGHTS,
	csPerMin: 0,
	visionPerMin: 0.17,
	killParticipation: 0.18,
};

export interface PlayerStats {
	puuid: string;
	name: string;
	championName: string;
	teamId: number;
	teamPosition: TeamPosition;
	win: boolean;
	kills: number;
	deaths: number;
	assists: number;
	kda: number;
	damageShare: number;
	killParticipation: number;
	csPerMin: number;
	visionPerMin: number;
	deadSeconds: number;
	deadRatio: number;
}

export interface PlayerScore extends PlayerStats {
	/** 0–100, 50 = even with lane opponent. */
	perf: number;
	/** 0–100, higher = more "gà". */
	gaScore: number;
	/** 1 = gà nhất among all 10 players. */
	lobbyRank: number;
	opponentPuuid: string | null;
}

export interface Title {
	emoji: string;
	name: string;
	puuid: string;
	detail: string;
}

export interface MatchReport {
	matchId: string;
	queueId: number;
	durationSec: number;
	endedAt: Date;
	/** All 10 players, most gà first. */
	lobby: PlayerScore[];
	/** Tracked players in this match, most gà first. */
	group: PlayerScore[];
	ga: PlayerScore | null;
	/** Only set when the group has ≥ 2 players. */
	mvp: PlayerScore | null;
	titles: Title[];
}

export function checkScorable(match: Match): { ok: boolean; reason?: string } {
	const { info } = match;
	if (info.mapId !== SUMMONERS_RIFT || !SCORABLE_QUEUES.has(info.queueId)) {
		return { ok: false, reason: `unsupported queue ${info.queueId}` };
	}
	if (info.gameDuration < MIN_DURATION_SEC) {
		return { ok: false, reason: "game too short" };
	}
	if (info.participants.some((p) => p.gameEndedInEarlySurrender)) {
		return { ok: false, reason: "remake" };
	}
	return { ok: true };
}

export function displayName(p: Participant): string {
	if (p.riotIdGameName) return p.riotIdGameName;
	return p.summonerName || p.championName;
}

export function computeStats(match: Match): PlayerStats[] {
	const { participants, gameDuration } = match.info;
	const minutes = Math.max(1, gameDuration / 60);

	const teamKills = new Map<number, number>();
	const teamDamage = new Map<number, number>();
	for (const p of participants) {
		teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.kills);
		teamDamage.set(
			p.teamId,
			(teamDamage.get(p.teamId) ?? 0) + p.totalDamageDealtToChampions,
		);
	}

	return participants.map((p) => {
		const kills = teamKills.get(p.teamId) ?? 0;
		const damage = teamDamage.get(p.teamId) ?? 0;
		return {
			puuid: p.puuid,
			name: displayName(p),
			championName: p.championName,
			teamId: p.teamId,
			teamPosition: p.teamPosition,
			win: p.win,
			kills: p.kills,
			deaths: p.deaths,
			assists: p.assists,
			kda: (p.kills + p.assists) / Math.max(1, p.deaths),
			damageShare: damage > 0 ? p.totalDamageDealtToChampions / damage : 0,
			killParticipation: kills > 0 ? (p.kills + p.assists) / kills : 0,
			csPerMin: (p.totalMinionsKilled + p.neutralMinionsKilled) / minutes,
			visionPerMin: p.visionScore / minutes,
			deadSeconds: p.totalTimeSpentDead,
			deadRatio: p.totalTimeSpentDead / Math.max(1, gameDuration),
		};
	});
}

const clamp = (v: number, lo: number, hi: number) =>
	Math.min(hi, Math.max(lo, v));

/** Ratio of a over b, smoothed and clamped to [0, 2] (1 = equal). */
function ratio(a: number, b: number, eps: number): number {
	return clamp((a + eps) / (b + eps), 0, 2);
}

function average(stats: PlayerStats[]): PlayerStats {
	const avg = (k: keyof PlayerStats) =>
		stats.reduce((s, p) => s + (p[k] as number), 0) / stats.length;
	return {
		...stats[0],
		puuid: "",
		deaths: avg("deaths"),
		kda: avg("kda"),
		damageShare: avg("damageShare"),
		killParticipation: avg("killParticipation"),
		csPerMin: avg("csPerMin"),
		visionPerMin: avg("visionPerMin"),
		deadSeconds: avg("deadSeconds"),
		deadRatio: avg("deadRatio"),
	};
}

/** Performance vs. a reference player, 0–100 (50 = even). */
export function performance(me: PlayerStats, ref: PlayerStats): number {
	const w = me.teamPosition === "UTILITY" ? SUPPORT_WEIGHTS : DEFAULT_WEIGHTS;
	const r: Record<MetricKey, number> = {
		// "lower is better" metrics are inverted
		deaths: ratio(ref.deaths, me.deaths, 1),
		kda: ratio(me.kda, ref.kda, 0.5),
		damageShare: ratio(me.damageShare, ref.damageShare, 0.02),
		killParticipation: ratio(me.killParticipation, ref.killParticipation, 0.05),
		csPerMin: ratio(me.csPerMin, ref.csPerMin, 0.5),
		visionPerMin: ratio(me.visionPerMin, ref.visionPerMin, 0.1),
		deadRatio: ratio(ref.deadRatio, me.deadRatio, 0.02),
	};
	let sum = 0;
	for (const k of Object.keys(w) as MetricKey[]) sum += w[k] * r[k];
	return (sum / 2) * 100;
}

function findOpponent(me: PlayerStats, all: PlayerStats[]): PlayerStats | null {
	if (!me.teamPosition) return null;
	return (
		all.find(
			(p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition,
		) ?? null
	);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function scoreMatch(
	match: Match,
	groupPuuids: Iterable<string>,
): MatchReport {
	const stats = computeStats(match);
	const lobbyAverage = average(stats);

	const scored = stats.map((s) => {
		const opponent = findOpponent(s, stats);
		const perf = performance(s, opponent ?? lobbyAverage);
		const ga = clamp((100 - perf) * (s.win ? 0.9 : 1.1), 0, 100);
		return {
			...s,
			perf: round1(perf),
			gaScore: round1(ga),
			lobbyRank: 0,
			opponentPuuid: opponent?.puuid ?? null,
		};
	});

	const lobby = [...scored].sort((a, b) => b.gaScore - a.gaScore);
	lobby.forEach((p, i) => {
		p.lobbyRank = i + 1;
	});

	const groupSet = new Set(groupPuuids);
	const group = lobby.filter((p) => groupSet.has(p.puuid));

	const { info } = match;
	return {
		matchId: match.metadata.matchId,
		queueId: info.queueId,
		durationSec: info.gameDuration,
		endedAt: new Date(
			info.gameEndTimestamp ?? info.gameCreation + info.gameDuration * 1000,
		),
		lobby,
		group,
		ga: group[0] ?? null,
		mvp: group.length >= 2 ? group[group.length - 1] : null,
		titles: group.length >= 2 ? awardTitles(group) : [],
	};
}

function pick<T>(items: T[], score: (t: T) => number): T | null {
	let best: T | null = null;
	let bestScore = -Infinity;
	for (const it of items) {
		const s = score(it);
		if (s > bestScore) {
			best = it;
			bestScore = s;
		}
	}
	return best;
}

/** Side titles, awarded only within the tracked group. */
export function awardTitles(group: PlayerScore[]): Title[] {
	const titles: Title[] = [];
	const add = (
		p: PlayerScore | null,
		emoji: string,
		name: string,
		detail: string,
	) => {
		if (p) titles.push({ emoji, name, puuid: p.puuid, detail });
	};

	const atm = pick(group, (p) => p.deaths);
	if (atm && atm.deaths > 0) {
		add(atm, "🏧", "Máy ATM", `${atm.deaths} lần nộp vàng cho địch`);
	}

	const spectator = pick(group, (p) => -p.killParticipation);
	add(
		spectator,
		"👀",
		"Khán giả",
		`tham gia ${Math.round((spectator?.killParticipation ?? 0) * 100)}% số mạng`,
	);

	const blind = pick(group, (p) => -p.visionPerMin);
	add(
		blind,
		"🦯",
		"Mù",
		`${blind?.visionPerMin.toFixed(2)} điểm tầm nhìn/phút`,
	);

	const farmers = group.filter((p) => p.teamPosition !== "UTILITY");
	const farmer = pick(farmers, (p) => -p.csPerMin);
	add(
		farmer,
		"🌾",
		"Nông dân thất nghiệp",
		`${farmer?.csPerMin.toFixed(1)} lính/phút`,
	);

	const sleeper = pick(group, (p) => p.deadSeconds);
	if (sleeper && sleeper.deadSeconds > 0) {
		const m = Math.floor(sleeper.deadSeconds / 60);
		const s = sleeper.deadSeconds % 60;
		add(sleeper, "🪦", "Nằm sàn lâu nhất", `${m}p${s}s xem màn hình xám`);
	}

	return titles;
}
