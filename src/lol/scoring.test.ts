import { describe, expect, it } from "bun:test";
import { checkScorable, scoreMatch } from "./scoring";
import type { Match, Participant, TeamPosition } from "./types";

const POSITIONS: TeamPosition[] = [
	"TOP",
	"JUNGLE",
	"MIDDLE",
	"BOTTOM",
	"UTILITY",
];

/** Average-ish line per role for a 30 min game. */
const BASE: Record<string, Partial<Participant>> = {
	TOP: {
		kills: 4,
		deaths: 4,
		assists: 4,
		totalMinionsKilled: 210,
		neutralMinionsKilled: 4,
		visionScore: 18,
		totalDamageDealtToChampions: 18000,
	},
	JUNGLE: {
		kills: 5,
		deaths: 4,
		assists: 8,
		totalMinionsKilled: 30,
		neutralMinionsKilled: 160,
		visionScore: 30,
		totalDamageDealtToChampions: 15000,
	},
	MIDDLE: {
		kills: 6,
		deaths: 4,
		assists: 6,
		totalMinionsKilled: 230,
		neutralMinionsKilled: 8,
		visionScore: 20,
		totalDamageDealtToChampions: 22000,
	},
	BOTTOM: {
		kills: 7,
		deaths: 4,
		assists: 5,
		totalMinionsKilled: 250,
		neutralMinionsKilled: 4,
		visionScore: 15,
		totalDamageDealtToChampions: 24000,
	},
	UTILITY: {
		kills: 1,
		deaths: 5,
		assists: 14,
		totalMinionsKilled: 30,
		neutralMinionsKilled: 0,
		visionScore: 70,
		totalDamageDealtToChampions: 8000,
	},
};

function player(
	team: 100 | 200,
	pos: TeamPosition,
	over: Partial<Participant> = {},
): Participant {
	return {
		puuid: `${team}-${pos}`,
		riotIdGameName: `${team}-${pos}`,
		championName: `Champ${pos}`,
		teamId: team,
		teamPosition: pos,
		win: team === 100,
		kills: 0,
		deaths: 0,
		assists: 0,
		totalMinionsKilled: 0,
		neutralMinionsKilled: 0,
		visionScore: 0,
		totalTimeSpentDead: 120,
		totalDamageDealtToChampions: 0,
		goldEarned: 10000,
		...BASE[pos],
		...over,
	};
}

function makeMatch(
	overrides: Record<string, Partial<Participant>> = {},
	info: Partial<Match["info"]> = {},
): Match {
	const participants = [100, 200].flatMap((team) =>
		POSITIONS.map((pos) =>
			player(team as 100 | 200, pos, overrides[`${team}-${pos}`]),
		),
	);
	return {
		metadata: {
			matchId: "VN2_123456",
			participants: participants.map((p) => p.puuid),
		},
		info: {
			gameCreation: 1_700_000_000_000,
			gameDuration: 1800,
			gameEndTimestamp: 1_700_001_800_000,
			gameMode: "CLASSIC",
			mapId: 11,
			queueId: 420,
			participants,
			...info,
		},
	};
}

describe("checkScorable", () => {
	it("accepts ranked SR games", () => {
		expect(checkScorable(makeMatch()).ok).toBe(true);
	});

	it("rejects remakes, short games and other modes", () => {
		expect(
			checkScorable(
				makeMatch({ "100-TOP": { gameEndedInEarlySurrender: true } }),
			).ok,
		).toBe(false);
		expect(checkScorable(makeMatch({}, { gameDuration: 200 })).ok).toBe(false);
		expect(checkScorable(makeMatch({}, { mapId: 12, queueId: 450 })).ok).toBe(
			false,
		);
	});
});

describe("scoreMatch", () => {
	it("picks the feeder as gà and the carry as MVP", () => {
		const match = makeMatch({
			"100-MIDDLE": {
				kills: 1,
				deaths: 12,
				assists: 2,
				totalMinionsKilled: 120,
				totalDamageDealtToChampions: 7000,
				totalTimeSpentDead: 500,
			},
			"100-BOTTOM": {
				kills: 15,
				deaths: 1,
				assists: 6,
				totalMinionsKilled: 290,
				totalDamageDealtToChampions: 40000,
				totalTimeSpentDead: 20,
			},
		});
		const report = scoreMatch(match, ["100-MIDDLE", "100-BOTTOM", "100-TOP"]);

		expect(report.ga?.puuid).toBe("100-MIDDLE");
		expect(report.mvp?.puuid).toBe("100-BOTTOM");
		expect(report.group.map((p) => p.puuid)).toEqual([
			"100-MIDDLE",
			"100-TOP",
			"100-BOTTOM",
		]);
		// The enemy ADC who got stomped by our 15/1 carry is also a strong candidate.
		expect(report.ga!.lobbyRank).toBeLessThanOrEqual(2);
		expect(report.lobby.slice(0, 2).map((p) => p.puuid)).toContain(
			"200-BOTTOM",
		);

		const atm = report.titles.find((t) => t.name === "Máy ATM");
		expect(atm?.puuid).toBe("100-MIDDLE");
	});

	it("does not punish an even support for low CS", () => {
		const report = scoreMatch(makeMatch(), ["100-UTILITY", "100-TOP"]);
		const support = report.group.find((p) => p.puuid === "100-UTILITY")!;
		// Equal to their lane opponent → perf ≈ 50
		expect(support.perf).toBeCloseTo(50, 0);
		expect(
			report.titles.find((t) => t.name === "Nông dân thất nghiệp")?.puuid,
		).toBe("100-TOP");
	});

	it("is harsher on losers than winners for the same line", () => {
		const report = scoreMatch(makeMatch(), []);
		const winTop = report.lobby.find((p) => p.puuid === "100-TOP")!;
		const loseTop = report.lobby.find((p) => p.puuid === "200-TOP")!;
		expect(loseTop.gaScore).toBeGreaterThan(winTop.gaScore);
	});

	it("handles a solo tracked player (no MVP, no titles)", () => {
		const report = scoreMatch(makeMatch(), ["200-JUNGLE"]);
		expect(report.ga?.puuid).toBe("200-JUNGLE");
		expect(report.mvp).toBeNull();
		expect(report.titles).toEqual([]);
		expect(report.ga!.lobbyRank).toBeGreaterThanOrEqual(1);
	});

	it("falls back to lobby average when no lane opponent exists", () => {
		const match = makeMatch({ "100-TOP": { teamPosition: "" } });
		const report = scoreMatch(match, ["100-TOP"]);
		expect(report.ga?.opponentPuuid).toBeNull();
		expect(Number.isFinite(report.ga!.gaScore)).toBe(true);
	});
});
