import type { LolConfig } from "../config";
import { createLogger } from "../logger";
import { LolDb } from "./db";
import { RiotClient } from "./riot-client";
import { LolService, setLolService } from "./service";

const logger = createLogger("Lol");

/**
 * Builds the LoL "Vua Gà" service if configured. Never throws: the music bot
 * must keep working even if Riot/Postgres are unavailable.
 */
export async function initLol(config: LolConfig): Promise<LolService | null> {
	if (!config.riotApiKey || !config.databaseUrl) {
		logger.warn("RIOT_API_KEY or DATABASE_URL missing; LoL feature disabled");
		return null;
	}
	try {
		const db = LolDb.connect(config.databaseUrl);
		await db.migrate();
		const riot = new RiotClient({
			apiKey: config.riotApiKey,
			accountRegion: config.accountRegion,
			matchRegion: config.matchRegion,
		});
		const service = new LolService(db, riot, {
			pollIntervalSec: config.pollIntervalSec,
		});
		setLolService(service);
		return service;
	} catch (error) {
		logger.error("Failed to init LoL feature; disabled:", error);
		return null;
	}
}
