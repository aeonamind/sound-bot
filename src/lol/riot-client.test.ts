import { describe, expect, it } from "bun:test";
import {
	normalizeMatchId,
	parseRiotId,
	RateLimiter,
	RiotApiError,
	RiotClient,
} from "./riot-client";

function fakeFetch(responses: Response[]) {
	const calls: string[] = [];
	const fn = (async (url: string) => {
		calls.push(url);
		const res = responses.shift();
		if (!res) throw new Error("no more responses");
		return res;
	}) as unknown as typeof fetch;
	return { fn, calls };
}

const noLimit = new RateLimiter([[1000, 1000]]);

describe("RiotClient", () => {
	it("retries on 429 using Retry-After", async () => {
		const sleeps: number[] = [];
		const { fn, calls } = fakeFetch([
			new Response("", { status: 429, headers: { "Retry-After": "2" } }),
			Response.json(["VN2_1"]),
		]);
		const client = new RiotClient({
			apiKey: "k",
			fetchFn: fn,
			limiter: noLimit,
			sleep: async (ms) => {
				sleeps.push(ms);
			},
		});

		expect(await client.getMatchIds("abc", 1)).toEqual(["VN2_1"]);
		expect(sleeps).toEqual([2000]);
		expect(calls[0]).toBe(
			"https://sea.api.riotgames.com/lol/match/v5/matches/by-puuid/abc/ids?start=0&count=1",
		);
	});

	it("returns null on 404 and throws on 403", async () => {
		const { fn } = fakeFetch([
			new Response("", { status: 404 }),
			new Response("forbidden", { status: 403 }),
		]);
		const client = new RiotClient({
			apiKey: "k",
			fetchFn: fn,
			limiter: noLimit,
		});
		expect(await client.getAccountByRiotId("A B", "VN2")).toBeNull();
		await expect(client.getMatch("VN2_1")).rejects.toBeInstanceOf(RiotApiError);
	});
});

describe("RateLimiter", () => {
	it("waits when a window is full", async () => {
		let now = 0;
		const sleeps: number[] = [];
		const limiter = new RateLimiter(
			[[2, 1000]],
			() => now,
			async (ms) => {
				sleeps.push(ms);
				now += ms;
			},
		);
		await limiter.acquire();
		await limiter.acquire();
		await limiter.acquire();
		expect(sleeps).toEqual([1000]);
	});
});

describe("normalizeMatchId", () => {
	it("accepts bare numbers, full IDs and URLs", () => {
		expect(normalizeMatchId("1234567890", "VN2")).toBe("VN2_1234567890");
		expect(normalizeMatchId(" vn2_1234567890 ", "VN2")).toBe("VN2_1234567890");
		expect(normalizeMatchId("KR-7012345678", "VN2")).toBe("KR_7012345678");
		expect(
			normalizeMatchId(
				"https://www.leagueofgraphs.com/match/vn/1234567890",
				"VN2",
			),
		).toBe("VN2_1234567890");
		expect(
			normalizeMatchId(
				"https://example.gg/match/EUW1_6543210987/overview",
				"VN2",
			),
		).toBe("EUW1_6543210987");
	});

	it("rejects garbage and too-short numbers", () => {
		expect(normalizeMatchId("abc", "VN2")).toBeNull();
		expect(normalizeMatchId("123", "VN2")).toBeNull();
		expect(normalizeMatchId("", "VN2")).toBeNull();
	});
});

describe("parseRiotId", () => {
	it("parses names with spaces and # in tag position", () => {
		expect(parseRiotId("Gà Con#VN2")).toEqual({
			gameName: "Gà Con",
			tagLine: "VN2",
		});
		expect(parseRiotId(" a#b#c ")).toEqual({ gameName: "a#b", tagLine: "c" });
		expect(parseRiotId("noTag")).toBeNull();
		expect(parseRiotId("#VN2")).toBeNull();
	});
});
