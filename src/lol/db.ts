import { SQL } from "bun";
import type { MatchReport } from "./scoring";

export interface LinkedAccount {
	guildId: string;
	discordId: string;
	puuid: string;
	riotId: string;
	lastMatchId: string | null;
}

export interface LeaderboardRow {
	discordId: string;
	games: number;
	gaCount: number;
	mvpCount: number;
	avgGaScore: number;
}

export class LolDb {
	constructor(private readonly sql: SQL) {}

	static connect(url: string): LolDb {
		return new LolDb(new SQL(url));
	}

	async migrate(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS lol_accounts (
				guild_id      TEXT NOT NULL,
				discord_id    TEXT NOT NULL,
				puuid         TEXT NOT NULL,
				riot_id       TEXT NOT NULL,
				last_match_id TEXT,
				created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
				PRIMARY KEY (guild_id, discord_id)
			)`;
		await this.sql`
			CREATE INDEX IF NOT EXISTS lol_accounts_puuid_idx ON lol_accounts (puuid)`;
		await this.sql`
			CREATE TABLE IF NOT EXISTS lol_guild_settings (
				guild_id   TEXT PRIMARY KEY,
				channel_id TEXT NOT NULL
			)`;
		await this.sql`
			CREATE TABLE IF NOT EXISTS lol_matches (
				match_id     TEXT NOT NULL,
				guild_id     TEXT NOT NULL,
				queue_id     INT  NOT NULL,
				ended_at     TIMESTAMPTZ NOT NULL,
				processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
				PRIMARY KEY (match_id, guild_id)
			)`;
		await this.sql`
			CREATE TABLE IF NOT EXISTS lol_match_scores (
				match_id   TEXT NOT NULL,
				guild_id   TEXT NOT NULL,
				puuid      TEXT NOT NULL,
				discord_id TEXT NOT NULL,
				champion   TEXT NOT NULL,
				kills      INT  NOT NULL,
				deaths     INT  NOT NULL,
				assists    INT  NOT NULL,
				win        BOOLEAN NOT NULL,
				ga_score   REAL NOT NULL,
				group_rank INT  NOT NULL,
				is_ga      BOOLEAN NOT NULL,
				is_mvp     BOOLEAN NOT NULL,
				titles     JSONB NOT NULL DEFAULT '[]'::jsonb,
				PRIMARY KEY (match_id, guild_id, puuid),
				FOREIGN KEY (match_id, guild_id) REFERENCES lol_matches (match_id, guild_id) ON DELETE CASCADE
			)`;
	}

	async linkAccount(
		a: Omit<LinkedAccount, "lastMatchId"> & { lastMatchId: string | null },
	): Promise<void> {
		await this.sql`
			INSERT INTO lol_accounts (guild_id, discord_id, puuid, riot_id, last_match_id)
			VALUES (${a.guildId}, ${a.discordId}, ${a.puuid}, ${a.riotId}, ${a.lastMatchId})
			ON CONFLICT (guild_id, discord_id) DO UPDATE
			SET puuid = EXCLUDED.puuid, riot_id = EXCLUDED.riot_id, last_match_id = EXCLUDED.last_match_id`;
	}

	async unlinkAccount(guildId: string, discordId: string): Promise<boolean> {
		const rows = await this.sql`
			DELETE FROM lol_accounts WHERE guild_id = ${guildId} AND discord_id = ${discordId}
			RETURNING puuid`;
		return rows.length > 0;
	}

	async getAccount(
		guildId: string,
		discordId: string,
	): Promise<LinkedAccount | null> {
		const rows = await this.sql`
			SELECT guild_id, discord_id, puuid, riot_id, last_match_id
			FROM lol_accounts WHERE guild_id = ${guildId} AND discord_id = ${discordId}`;
		return rows.length ? toAccount(rows[0]) : null;
	}

	async listAccounts(guildId?: string): Promise<LinkedAccount[]> {
		const rows = guildId
			? await this.sql`
				SELECT guild_id, discord_id, puuid, riot_id, last_match_id
				FROM lol_accounts WHERE guild_id = ${guildId}`
			: await this.sql`
				SELECT guild_id, discord_id, puuid, riot_id, last_match_id FROM lol_accounts`;
		return rows.map(toAccount);
	}

	async setLastMatch(puuid: string, matchId: string): Promise<void> {
		await this
			.sql`UPDATE lol_accounts SET last_match_id = ${matchId} WHERE puuid = ${puuid}`;
	}

	async setChannel(guildId: string, channelId: string): Promise<void> {
		await this.sql`
			INSERT INTO lol_guild_settings (guild_id, channel_id) VALUES (${guildId}, ${channelId})
			ON CONFLICT (guild_id) DO UPDATE SET channel_id = EXCLUDED.channel_id`;
	}

	async getChannel(guildId: string): Promise<string | null> {
		const rows = await this.sql`
			SELECT channel_id FROM lol_guild_settings WHERE guild_id = ${guildId}`;
		return rows.length ? (rows[0].channel_id as string) : null;
	}

	async isProcessed(matchId: string, guildId: string): Promise<boolean> {
		const rows = await this.sql`
			SELECT 1 FROM lol_matches WHERE match_id = ${matchId} AND guild_id = ${guildId}`;
		return rows.length > 0;
	}

	/**
	 * Records a processed match and its group scores. Returns false if another
	 * run already recorded it (so the caller must not announce again).
	 */
	async saveReport(
		guildId: string,
		report: MatchReport,
		discordIdByPuuid: Map<string, string>,
	): Promise<boolean> {
		return this.sql.begin(async (tx) => {
			const inserted = await tx`
				INSERT INTO lol_matches (match_id, guild_id, queue_id, ended_at)
				VALUES (${report.matchId}, ${guildId}, ${report.queueId}, ${report.endedAt})
				ON CONFLICT DO NOTHING
				RETURNING match_id`;
			if (inserted.length === 0) return false;

			for (const [i, p] of report.group.entries()) {
				const titles = report.titles
					.filter((t) => t.puuid === p.puuid)
					.map((t) => t.name);
				await tx`
					INSERT INTO lol_match_scores (
						match_id, guild_id, puuid, discord_id, champion, kills, deaths, assists,
						win, ga_score, group_rank, is_ga, is_mvp, titles
					) VALUES (
						${report.matchId}, ${guildId}, ${p.puuid}, ${discordIdByPuuid.get(p.puuid) ?? ""},
						${p.championName}, ${p.kills}, ${p.deaths}, ${p.assists}, ${p.win}, ${p.gaScore},
						${i + 1}, ${report.mvp !== null && report.ga?.puuid === p.puuid},
						${report.mvp?.puuid === p.puuid}, ${JSON.stringify(titles)}::jsonb
					)`;
			}
			return true;
		});
	}

	async leaderboard(
		guildId: string,
		since: Date | null,
	): Promise<LeaderboardRow[]> {
		const from = since ?? new Date(0);
		const rows = await this.sql`
			SELECT s.discord_id,
				COUNT(*)::int                          AS games,
				COUNT(*) FILTER (WHERE s.is_ga)::int   AS ga_count,
				COUNT(*) FILTER (WHERE s.is_mvp)::int  AS mvp_count,
				AVG(s.ga_score)::float8                AS avg_ga
			FROM lol_match_scores s
			JOIN lol_matches m ON m.match_id = s.match_id AND m.guild_id = s.guild_id
			WHERE s.guild_id = ${guildId} AND m.ended_at >= ${from}
			GROUP BY s.discord_id
			ORDER BY ga_count DESC, avg_ga DESC
			LIMIT 10`;
		return rows.map((r: Record<string, unknown>) => ({
			discordId: r.discord_id as string,
			games: Number(r.games),
			gaCount: Number(r.ga_count),
			mvpCount: Number(r.mvp_count),
			avgGaScore: Number(r.avg_ga),
		}));
	}

	async close(): Promise<void> {
		await this.sql.close();
	}
}

function toAccount(r: Record<string, unknown>): LinkedAccount {
	return {
		guildId: r.guild_id as string,
		discordId: r.discord_id as string,
		puuid: r.puuid as string,
		riotId: r.riot_id as string,
		lastMatchId: (r.last_match_id as string | null) ?? null,
	};
}
