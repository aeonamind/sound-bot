import { type Client, Events, type SendableChannels } from "discord.js";
import type { CustomClient } from "../bot/client";
import { createLogger } from "../logger";
import { buildReportMessage, playGaSound } from "./announce";
import type { LinkedAccount, LolDb } from "./db";
import type { RiotClient } from "./riot-client";
import { checkScorable, type MatchReport, scoreMatch } from "./scoring";
import type { Match } from "./types";

const logger = createLogger("LolService");

export interface LolServiceOptions {
	pollIntervalSec: number;
}

export class LolService {
	private timer: ReturnType<typeof setInterval> | null = null;
	private running = false;

	constructor(
		readonly db: LolDb,
		readonly riot: RiotClient,
		private readonly options: LolServiceOptions,
	) {}

	/** Starts polling once the Discord client is ready. */
	start(client: CustomClient): void {
		const begin = () => {
			logger.log(
				`LoL tracker started (poll every ${this.options.pollIntervalSec}s)`,
			);
			void this.tick(client);
			this.timer = setInterval(
				() => void this.tick(client),
				this.options.pollIntervalSec * 1000,
			);
		};
		if (client.isReady()) begin();
		else client.once(Events.ClientReady, begin);
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** One polling pass. Overlapping passes are skipped. */
	async tick(client: CustomClient): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			await this.pollOnce(client);
		} catch (error) {
			logger.error("Tracker tick failed:", error);
		} finally {
			this.running = false;
		}
	}

	private async pollOnce(client: CustomClient): Promise<void> {
		const accounts = await this.db.listAccounts();
		if (accounts.length === 0) return;

		const byPuuid = groupBy(accounts, (a) => a.puuid);
		// matchId → puuids whose latest match it is
		const newMatches = new Map<string, string[]>();

		for (const [puuid, rows] of byPuuid) {
			try {
				const [latest] = await this.riot.getMatchIds(puuid, 1);
				if (!latest) continue;
				const last = rows[0].lastMatchId;
				if (last === null) {
					// First sight: set a baseline, never announce old games.
					await this.db.setLastMatch(puuid, latest);
					continue;
				}
				if (latest === last) continue;
				newMatches.set(latest, [...(newMatches.get(latest) ?? []), puuid]);
			} catch (error) {
				logger.error(`Failed to poll ${rows[0].riotId}:`, error);
			}
		}

		for (const [matchId, puuids] of newMatches) {
			try {
				await this.processMatch(client, matchId, accounts);
				// Advance only after success so failures are retried next tick.
				for (const puuid of puuids) await this.db.setLastMatch(puuid, matchId);
			} catch (error) {
				logger.error(`Failed to process match ${matchId}:`, error);
			}
		}
	}

	private async processMatch(
		client: CustomClient,
		matchId: string,
		accounts: LinkedAccount[],
	): Promise<void> {
		const match = await this.riot.getMatch(matchId);
		if (!match) {
			throw new Error(`Match ${matchId} not found yet`);
		}

		const scorable = checkScorable(match);
		if (!scorable.ok) {
			logger.log(`Skip ${matchId}: ${scorable.reason}`);
			return;
		}

		const inMatch = new Set(match.metadata.participants);
		const byGuild = groupBy(
			accounts.filter((a) => inMatch.has(a.puuid)),
			(a) => a.guildId,
		);

		for (const [guildId, members] of byGuild) {
			const { report, discordIdByPuuid } = this.buildReport(match, members);
			const isNew = await this.db.saveReport(guildId, report, discordIdByPuuid);
			if (!isNew) continue;
			logger.log(
				`Match ${matchId} in guild ${guildId}: gà = ${report.ga?.name} (${report.ga?.gaScore})`,
			);
			await this.announce(client, guildId, report, discordIdByPuuid);
		}
	}

	buildReport(
		match: Match,
		members: LinkedAccount[],
	): { report: MatchReport; discordIdByPuuid: Map<string, string> } {
		const discordIdByPuuid = new Map(
			members.map((m) => [m.puuid, m.discordId]),
		);
		const report = scoreMatch(match, discordIdByPuuid.keys());
		return { report, discordIdByPuuid };
	}

	private async announce(
		client: CustomClient,
		guildId: string,
		report: MatchReport,
		discordIdByPuuid: Map<string, string>,
	): Promise<void> {
		const message = buildReportMessage(report, discordIdByPuuid);
		if (!message) return;

		const channelId = await this.db.getChannel(guildId);
		if (!channelId) {
			logger.warn(`Guild ${guildId} has no /lol channel set; not announcing`);
			return;
		}

		const channel = await fetchTextChannel(client, channelId);
		if (!channel) {
			logger.warn(`Announce channel ${channelId} not found or not text`);
			return;
		}
		await channel.send(message);

		const gaDiscordId = report.ga && discordIdByPuuid.get(report.ga.puuid);
		const guild = client.guilds.cache.get(guildId);
		if (gaDiscordId && guild) {
			await playGaSound(client, guild, gaDiscordId);
		}
	}
}

async function fetchTextChannel(
	client: Client,
	channelId: string,
): Promise<SendableChannels | null> {
	const channel = await client.channels.fetch(channelId).catch(() => null);
	return channel?.isSendable() ? channel : null;
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
	const map = new Map<K, T[]>();
	for (const it of items) {
		const k = key(it);
		map.set(k, [...(map.get(k) ?? []), it]);
	}
	return map;
}

let instance: LolService | null = null;

export function setLolService(service: LolService | null): void {
	instance = service;
}

/** Null when RIOT_API_KEY / DATABASE_URL aren't configured. */
export function getLolService(): LolService | null {
	return instance;
}
