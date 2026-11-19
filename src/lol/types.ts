/** Subset of Riot match-v5 DTOs used by the "Vua Gà" feature. */

export interface RiotAccount {
	puuid: string;
	gameName: string;
	tagLine: string;
}

export type TeamPosition =
	| "TOP"
	| "JUNGLE"
	| "MIDDLE"
	| "BOTTOM"
	| "UTILITY"
	| "";

export interface ParticipantChallenges {
	kda?: number;
	killParticipation?: number;
	teamDamagePercentage?: number;
	visionScorePerMinute?: number;
}

export interface Participant {
	puuid: string;
	riotIdGameName?: string;
	riotIdTagline?: string;
	summonerName?: string;
	championName: string;
	teamId: number;
	teamPosition: TeamPosition;
	win: boolean;
	kills: number;
	deaths: number;
	assists: number;
	totalMinionsKilled: number;
	neutralMinionsKilled: number;
	visionScore: number;
	totalTimeSpentDead: number;
	totalDamageDealtToChampions: number;
	goldEarned: number;
	gameEndedInEarlySurrender?: boolean;
	challenges?: ParticipantChallenges;
}

export interface MatchInfo {
	gameCreation: number;
	gameDuration: number; // seconds
	gameEndTimestamp?: number;
	gameMode: string;
	mapId: number;
	queueId: number;
	participants: Participant[];
}

export interface Match {
	metadata: { matchId: string; participants: string[] };
	info: MatchInfo;
}
