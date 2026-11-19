import type {
	BuildingKillEvent,
	ChampionKillEvent,
	MapPosition,
	Timeline,
} from "./types";

/** How a player died, derived from the match timeline. */
export interface DeathStats {
	deaths: number;
	/** Solo deaths (no teammate fighting nearby) where 3+ enemies took part. */
	outnumbered: number;
	/** Deaths near an enemy turret that was still standing. */
	turretDives: number;
	/** Deaths that came ≤ QUICK_REDEATH_MS after the previous death. */
	quickRedeaths: number;
	/** Most deaths inside any STREAK_WINDOW_MS window. */
	maxStreak: number;
	/** Most deaths clustered around one spot (≤ SAME_SPOT_RADIUS). */
	sameSpotMax: number;
}

export const OUTNUMBERED_MIN_ENEMIES = 3;
/** A teammate in a kill event this close in time/space means it was a teamfight, not a solo dive. */
export const TEAMFIGHT_WINDOW_MS = 15_000;
export const TEAMFIGHT_RADIUS = 2500;
export const TURRET_RADIUS = 1000;
export const QUICK_REDEATH_MS = 75_000;
export const STREAK_WINDOW_MS = 5 * 60_000;
export const SAME_SPOT_RADIUS = 1200;

interface Turret {
	team: number;
	pos: MapPosition;
}

/** Summoner's Rift turret positions (owner team), as reported by Riot BUILDING_KILL events. */
export const SR_TURRETS: Turret[] = [
	// Blue (100): top outer/inner/inhib, mid outer/inner/inhib, bot outer/inner/inhib, nexus x2
	{ team: 100, pos: { x: 981, y: 10441 } },
	{ team: 100, pos: { x: 1512, y: 6699 } },
	{ team: 100, pos: { x: 1169, y: 4287 } },
	{ team: 100, pos: { x: 5846, y: 6396 } },
	{ team: 100, pos: { x: 5048, y: 4812 } },
	{ team: 100, pos: { x: 3651, y: 3696 } },
	{ team: 100, pos: { x: 10504, y: 1029 } },
	{ team: 100, pos: { x: 6919, y: 1483 } },
	{ team: 100, pos: { x: 4281, y: 1253 } },
	{ team: 100, pos: { x: 1748, y: 2270 } },
	{ team: 100, pos: { x: 2177, y: 1807 } },
	// Red (200)
	{ team: 200, pos: { x: 4318, y: 13875 } },
	{ team: 200, pos: { x: 7943, y: 13411 } },
	{ team: 200, pos: { x: 10481, y: 13650 } },
	{ team: 200, pos: { x: 8955, y: 8510 } },
	{ team: 200, pos: { x: 9767, y: 10113 } },
	{ team: 200, pos: { x: 11134, y: 11207 } },
	{ team: 200, pos: { x: 13866, y: 4505 } },
	{ team: 200, pos: { x: 13327, y: 8226 } },
	{ team: 200, pos: { x: 13624, y: 10572 } },
	{ team: 200, pos: { x: 12611, y: 13084 } },
	{ team: 200, pos: { x: 13052, y: 12612 } },
];

/** True if any of the victim's teammates killed, assisted or died close to this death. */
function teammateFoughtNearby(
	death: ChampionKillEvent,
	team: number,
	kills: ChampionKillEvent[],
	teamById: Map<number, number>,
): boolean {
	return kills.some((k) => {
		if (k === death) return false;
		if (Math.abs(k.timestamp - death.timestamp) > TEAMFIGHT_WINDOW_MS)
			return false;
		if (dist(k.position, death.position) > TEAMFIGHT_RADIUS) return false;
		const involved = [
			k.victimId,
			k.killerId,
			...(k.assistingParticipantIds ?? []),
		].filter((id) => id !== death.victimId);
		return involved.some((id) => teamById.get(id) === team);
	});
}

const dist = (a: MapPosition, b: MapPosition) =>
	Math.hypot(a.x - b.x, a.y - b.y);

export function emptyDeathStats(): DeathStats {
	return {
		deaths: 0,
		outnumbered: 0,
		turretDives: 0,
		quickRedeaths: 0,
		maxStreak: 0,
		sameSpotMax: 0,
	};
}

/**
 * @param teamByPuuid teamId of each participant (from match-v5 info).
 * @returns DeathStats per puuid.
 */
export function analyzeDeaths(
	timeline: Timeline,
	teamByPuuid: Map<string, number>,
): Map<string, DeathStats> {
	const puuidById = new Map(
		timeline.info.participants.map((p) => [p.participantId, p.puuid]),
	);
	const events = timeline.info.frames.flatMap((f) => f.events);
	const kills = events.filter(
		(e): e is ChampionKillEvent => e.type === "CHAMPION_KILL",
	);
	const teamById = new Map<number, number>();
	for (const [id, puuid] of puuidById) {
		const team = teamByPuuid.get(puuid);
		if (team) teamById.set(id, team);
	}

	// When each turret fell (matched to our table by nearest position).
	const turretDeathAt = new Map<Turret, number>();
	for (const e of events) {
		if (e.type !== "BUILDING_KILL") continue;
		const b = e as BuildingKillEvent;
		if (b.buildingType !== "TOWER_BUILDING") continue;
		const turret = SR_TURRETS.find((t) => dist(t.pos, b.position) < 300);
		if (turret && !turretDeathAt.has(turret)) {
			turretDeathAt.set(turret, b.timestamp);
		}
	}

	const deathsByPuuid = new Map<string, ChampionKillEvent[]>();
	for (const e of events) {
		if (e.type !== "CHAMPION_KILL") continue;
		const k = e as ChampionKillEvent;
		const victim = puuidById.get(k.victimId);
		if (!victim) continue;
		deathsByPuuid.set(victim, [...(deathsByPuuid.get(victim) ?? []), k]);
	}

	const result = new Map<string, DeathStats>();
	for (const [puuid, team] of teamByPuuid) {
		const deaths = (deathsByPuuid.get(puuid) ?? []).sort(
			(a, b) => a.timestamp - b.timestamp,
		);
		const s = emptyDeathStats();
		s.deaths = deaths.length;

		deaths.forEach((d, i) => {
			const enemies =
				(d.killerId > 0 ? 1 : 0) + (d.assistingParticipantIds?.length ?? 0);
			if (
				enemies >= OUTNUMBERED_MIN_ENEMIES &&
				!teammateFoughtNearby(d, team, kills, teamById)
			) {
				s.outnumbered++;
			}

			const nearEnemyTurret = SR_TURRETS.some(
				(t) =>
					t.team !== team &&
					dist(t.pos, d.position) <= TURRET_RADIUS &&
					(turretDeathAt.get(t) ?? Number.POSITIVE_INFINITY) > d.timestamp,
			);
			if (nearEnemyTurret) s.turretDives++;

			if (i > 0 && d.timestamp - deaths[i - 1].timestamp <= QUICK_REDEATH_MS) {
				s.quickRedeaths++;
			}

			let inWindow = 0;
			let sameSpot = 0;
			for (const other of deaths) {
				const dt = other.timestamp - d.timestamp;
				if (dt >= 0 && dt <= STREAK_WINDOW_MS) inWindow++;
				if (dist(other.position, d.position) <= SAME_SPOT_RADIUS) sameSpot++;
			}
			s.maxStreak = Math.max(s.maxStreak, inWindow);
			s.sameSpotMax = Math.max(s.sameSpotMax, sameSpot);
		});

		result.set(puuid, s);
	}
	return result;
}

export type DauTrauTrait =
	| "outnumbered"
	| "turretDives"
	| "quickRedeaths"
	| "sameSpot"
	| "streak";

/** Minimum counts before a trait counts as "đầu trâu" behaviour. */
export const TRAIT_THRESHOLDS: Record<DauTrauTrait, number> = {
	outnumbered: 3,
	turretDives: 2,
	quickRedeaths: 2,
	sameSpot: 3,
	streak: 3,
};

function traitValue(s: DeathStats, t: DauTrauTrait): number {
	switch (t) {
		case "outnumbered":
			return s.outnumbered;
		case "turretDives":
			return s.turretDives;
		case "quickRedeaths":
			return s.quickRedeaths;
		case "sameSpot":
			return s.sameSpotMax;
		case "streak":
			return s.maxStreak;
	}
}

/** Strongest trait (by how far it exceeds its threshold), or null. */
export function strongestTrait(
	s: DeathStats | undefined,
): { trait: DauTrauTrait; value: number } | null {
	if (!s) return null;
	let best: { trait: DauTrauTrait; value: number; ratio: number } | null = null;
	for (const trait of Object.keys(TRAIT_THRESHOLDS) as DauTrauTrait[]) {
		const value = traitValue(s, trait);
		const ratio = value / TRAIT_THRESHOLDS[trait];
		if (ratio >= 1 && (!best || ratio > best.ratio)) {
			best = { trait, value, ratio };
		}
	}
	return best && { trait: best.trait, value: best.value };
}

/** Overall "đầu trâu" score used for the 🐂 title. */
export function dauTrauScore(s: DeathStats | undefined): number {
	if (!s) return 0;
	return s.outnumbered + s.turretDives + s.quickRedeaths;
}

/** Short Vietnamese summary like "lao vào 1 vs 3 bốn lần, chết dưới trụ địch 2 lần". */
export function describeDauTrau(s: DeathStats): string {
	const parts: string[] = [];
	if (s.outnumbered) parts.push(`lao vào 1 đánh nhiều ${s.outnumbered} lần`);
	if (s.turretDives) parts.push(`chết dưới trụ địch ${s.turretDives} lần`);
	if (s.quickRedeaths)
		parts.push(`vừa hồi sinh đã chết ${s.quickRedeaths} lần`);
	return parts.join(", ");
}
