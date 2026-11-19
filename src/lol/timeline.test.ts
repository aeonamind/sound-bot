import { describe, expect, it } from "bun:test";
import { gaRoast, mvpLine } from "./roasts";
import { analyzeDeaths, strongestTrait } from "./timeline";
import type { Timeline, TimelineEvent } from "./types";

// participantId 1 = blue mid "me", 2 = blue teammate, 6..10 = red team
const ME = "me";
const MATE = "mate";
const teamByPuuid = new Map<string, number>([
	[ME, 100],
	[MATE, 100],
	...[6, 7, 8, 9, 10].map((i) => [`red${i}`, 200] as [string, number]),
]);

function timeline(events: TimelineEvent[]): Timeline {
	return {
		info: {
			participants: [
				{ participantId: 1, puuid: ME },
				{ participantId: 2, puuid: MATE },
				...[6, 7, 8, 9, 10].map((i) => ({
					participantId: i,
					puuid: `red${i}`,
				})),
			],
			frames: [{ timestamp: 0, events }],
		},
	};
}

const kill = (
	t: number,
	x: number,
	y: number,
	assists: number[] = [],
): TimelineEvent => ({
	type: "CHAMPION_KILL",
	timestamp: t * 1000,
	killerId: 6,
	victimId: 1,
	assistingParticipantIds: assists,
	position: { x, y },
});

// Red mid outer turret is at (8955, 8510)
describe("analyzeDeaths", () => {
	it("detects outnumbered, turret dives, quick re-deaths, streaks and same-spot deaths", () => {
		const tl = timeline([
			kill(300, 8900, 8400, [7, 8]), // 1v3 under red mid outer turret
			kill(350, 8800, 8450, [7, 8, 9]), // 50s later: quick, 1v4, same turret
			kill(400, 8700, 8300), // quick, same spot, solo
			kill(1500, 2000, 12000), // far away, late
		]);
		const s = analyzeDeaths(tl, teamByPuuid).get(ME)!;
		expect(s.deaths).toBe(4);
		expect(s.outnumbered).toBe(2);
		expect(s.turretDives).toBe(3);
		expect(s.quickRedeaths).toBe(2);
		expect(s.maxStreak).toBe(3);
		expect(s.sameSpotMax).toBe(3);
	});

	it("ignores turrets that were already destroyed", () => {
		const tl = timeline([
			{
				type: "BUILDING_KILL",
				timestamp: 200_000,
				buildingType: "TOWER_BUILDING",
				teamId: 200,
				position: { x: 8955, y: 8510 },
			} as TimelineEvent,
			kill(300, 8900, 8400),
		]);
		expect(analyzeDeaths(tl, teamByPuuid).get(ME)!.turretDives).toBe(0);
	});

	it("does not call a teamfight death a solo 1vN dive", () => {
		const tl = timeline([
			kill(600, 7000, 7000, [7, 8]), // me dies to 3 enemies...
			{
				type: "CHAMPION_KILL",
				timestamp: 605_000, // ...while my teammate kills red7 right next to me
				killerId: 2,
				victimId: 7,
				assistingParticipantIds: [],
				position: { x: 7300, y: 7100 },
			} as TimelineEvent,
			kill(1200, 7000, 7000, [7, 8]), // later: truly alone
		]);
		expect(analyzeDeaths(tl, teamByPuuid).get(ME)!.outnumbered).toBe(1);
	});

	it("does not count deaths near your own turret", () => {
		// Blue mid outer turret (5846, 6396)
		const tl = timeline([kill(300, 5800, 6300), kill(900, 5800, 6300)]);
		expect(analyzeDeaths(tl, teamByPuuid).get(ME)!.turretDives).toBe(0);
	});
});

describe("roasts", () => {
	const base = { name: "W4n", championName: "Yasuo" };
	const sweep = (fn: (r: () => number) => string) =>
		Array.from({ length: 40 }, (_, i) => fn(() => i / 40));

	it("never leaves unfilled placeholders", () => {
		const lines = [
			...sweep((r) => gaRoast({ ...base, win: false }, r)),
			...sweep((r) => gaRoast({ ...base, win: true }, r)),
			...sweep((r) => mvpLine("W4n", "Yasuo", r)),
		];
		for (const l of lines) expect(l).not.toMatch(/\{\w+\}/);
	});

	it("uses the matching đầu trâu line when the timeline shows it", () => {
		const deathStats = {
			deaths: 6,
			outnumbered: 0,
			turretDives: 0,
			quickRedeaths: 0,
			maxStreak: 2,
			sameSpotMax: 5,
		};
		expect(strongestTrait(deathStats)).toEqual({ trait: "sameSpot", value: 5 });
		expect(gaRoast({ ...base, win: false, deathStats })).toBe(
			"W4n đầu trâu thật sự, chết 5 lần ở cùng một chỗ vẫn quay lại lần thứ 6.",
		);
	});

	it("does not use loss-flavoured đầu trâu lines on a win", () => {
		const deathStats = {
			deaths: 6,
			outnumbered: 5,
			turretDives: 0,
			quickRedeaths: 0,
			maxStreak: 2,
			sameSpotMax: 1,
		};
		const line = gaRoast({ ...base, win: true, deathStats }, () => 0);
		expect(line).not.toContain("mặt ngựa");
	});
});
