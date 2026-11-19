import { createLogger } from "../logger";
import type { Match, RiotAccount } from "./types";

const logger = createLogger("RiotClient");

export class RiotApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "RiotApiError";
	}
}

interface Window {
	limit: number;
	ms: number;
	stamps: number[];
}

/** Sliding-window limiter matching Riot's per-app limits (default: 20/1s, 100/2min). */
export class RateLimiter {
	private readonly windows: Window[];
	private chain: Promise<void> = Promise.resolve();

	constructor(
		limits: Array<[limit: number, ms: number]> = [
			[20, 1_000],
			[100, 120_000],
		],
		private readonly now: () => number = Date.now,
		private readonly sleep: (ms: number) => Promise<void> = Bun.sleep,
	) {
		this.windows = limits.map(([limit, ms]) => ({ limit, ms, stamps: [] }));
	}

	acquire(): Promise<void> {
		const next = this.chain.then(() => this.waitForSlot());
		this.chain = next.catch(() => {});
		return next;
	}

	private async waitForSlot(): Promise<void> {
		for (;;) {
			const now = this.now();
			let waitMs = 0;
			for (const w of this.windows) {
				w.stamps = w.stamps.filter((s) => now - s < w.ms);
				if (w.stamps.length >= w.limit) {
					waitMs = Math.max(waitMs, w.stamps[0] + w.ms - now);
				}
			}
			if (waitMs <= 0) break;
			await this.sleep(waitMs);
		}
		const stamp = this.now();
		for (const w of this.windows) w.stamps.push(stamp);
	}
}

export interface RiotClientOptions {
	apiKey: string;
	/** Regional routing for account-v1 (americas | asia | europe). */
	accountRegion?: string;
	/** Regional routing for match-v5. VN2 → sea. */
	matchRegion?: string;
	fetchFn?: typeof fetch;
	limiter?: RateLimiter;
	sleep?: (ms: number) => Promise<void>;
	maxRetries?: number;
}

export class RiotClient {
	private readonly fetchFn: typeof fetch;
	private readonly limiter: RateLimiter;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly accountRegion: string;
	private readonly matchRegion: string;
	private readonly maxRetries: number;

	constructor(private readonly options: RiotClientOptions) {
		this.fetchFn = options.fetchFn ?? fetch;
		this.limiter = options.limiter ?? new RateLimiter();
		this.sleep = options.sleep ?? Bun.sleep;
		this.accountRegion = options.accountRegion ?? "asia";
		this.matchRegion = options.matchRegion ?? "sea";
		this.maxRetries = options.maxRetries ?? 3;
	}

	getAccountByRiotId(
		gameName: string,
		tagLine: string,
	): Promise<RiotAccount | null> {
		return this.get<RiotAccount>(
			this.accountRegion,
			`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
		);
	}

	async getMatchIds(puuid: string, count = 1): Promise<string[]> {
		const ids = await this.get<string[]>(
			this.matchRegion,
			`/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`,
		);
		return ids ?? [];
	}

	getMatch(matchId: string): Promise<Match | null> {
		return this.get<Match>(
			this.matchRegion,
			`/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
		);
	}

	/** Returns null on 404, throws RiotApiError on other failures. */
	private async get<T>(region: string, path: string): Promise<T | null> {
		const url = `https://${region}.api.riotgames.com${path}`;

		for (let attempt = 0; ; attempt++) {
			await this.limiter.acquire();
			const res = await this.fetchFn(url, {
				headers: { "X-Riot-Token": this.options.apiKey },
			});

			if (res.ok) return (await res.json()) as T;
			if (res.status === 404) return null;

			const retryable = res.status === 429 || res.status >= 500;
			if (retryable && attempt < this.maxRetries) {
				const retryAfter = Number(res.headers.get("retry-after"));
				const waitMs =
					Number.isFinite(retryAfter) && retryAfter > 0
						? retryAfter * 1000
						: 1000 * 2 ** attempt;
				logger.warn(
					`Riot API ${res.status} on ${path}, retrying in ${waitMs}ms`,
				);
				await this.sleep(waitMs);
				continue;
			}

			throw new RiotApiError(
				res.status,
				`Riot API ${res.status} for ${path}: ${await res.text().catch(() => "")}`,
			);
		}
	}
}

/** Parses "Name#TAG" (whitespace tolerant). Returns null if malformed. */
export function parseRiotId(
	input: string,
): { gameName: string; tagLine: string } | null {
	const idx = input.lastIndexOf("#");
	if (idx <= 0) return null;
	const gameName = input.slice(0, idx).trim();
	const tagLine = input.slice(idx + 1).trim();
	if (!gameName || !tagLine) return null;
	return { gameName, tagLine };
}
