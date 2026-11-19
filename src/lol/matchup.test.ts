import { describe, expect, it } from "bun:test";
import {
	computeLaneDiff,
	describeDiff,
	fmt,
	type LaneNumbers,
	statCallouts,
} from "./matchup";
import type { Timeline } from "./types";

const tryndamere: LaneNumbers = {
	puuid: "w4n",
	name: "W4n",
	championName: "Tryndamere",
	teamPosition: "TOP",
	kills: 0,
	deaths: 12,
	assists: 0,
	gold: 6200,
	cs: 140,
	damage: 4100,
	damageShare: 0.06,
	visionScore: 5,
	level: 12,
};

const darius: LaneNumbers = {
	...tryndamere,
	puuid: "opp",
	name: "Enemy",
	championName: "Darius",
	kills: 11,
	deaths: 2,
	assists: 4,
	gold: 13900,
	cs: 230,
	damage: 28000,
	damageShare: 0.31,
	visionScore: 14,
	level: 17,
};

const timeline: Timeline = {
	info: {
		participants: [
			{ participantId: 1, puuid: "w4n" },
			{ participantId: 6, puuid: "opp" },
		],
		frames: [
			{ timestamp: 0, events: [] },
			{
				timestamp: 900_150,
				events: [],
				participantFrames: {
					"1": {
						totalGold: 3100,
						minionsKilled: 70,
						jungleMinionsKilled: 0,
						level: 8,
					},
					"6": {
						totalGold: 6400,
						minionsKilled: 118,
						jungleMinionsKilled: 4,
						level: 11,
					},
				},
			},
		],
	},
};

describe("lane diff", () => {
	it("computes end-of-game and 15-minute gaps", () => {
		const d = computeLaneDiff(tryndamere, darius, timeline);
		expect(d.gold).toBe(-7700);
		expect(d.cs).toBe(-90);
		expect(d.level).toBe(-5);
		expect(d.at15).toEqual({ gold: -3300, cs: -52 });
		expect(describeDiff(d)).toContain("Vàng **-7.700**");
		expect(describeDiff(d)).toContain("Phút 15: vàng **-3.300**");
	});

	it("roasts the 0/12/0 Tryndamere with varied, number-backed lines", () => {
		const d = computeLaneDiff(tryndamere, darius, timeline);
		const lines = statCallouts(tryndamere, d, 3);
		expect(lines).toHaveLength(3);
		expect(lines[0]).toStartWith("0/12/0: W4n vào trận chỉ để đi dạo");
		// One line per topic: the second "deaths" line is dropped in favour of gold.
		expect(lines.filter((l) => l.includes("mạng dâng"))).toHaveLength(0);
		expect(lines[1]).toContain("Kém Enemy (Darius) tận 7.700 vàng");
	});

	it("stays quiet for an even lane", () => {
		const d = computeLaneDiff(darius, { ...darius, puuid: "x", name: "X" });
		expect(statCallouts(darius, d)).toEqual([]);
	});

	it("formats numbers Vietnamese-style", () => {
		expect(fmt(1234567)).toBe("1.234.567");
		expect(fmt(-4520)).toBe("-4.520");
		expect(fmt(12)).toBe("12");
	});
});
