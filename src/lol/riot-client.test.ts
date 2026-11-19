import { describe, expect, it } from "bun:test";
import {
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
