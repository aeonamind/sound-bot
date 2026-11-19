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

export interface MapPosition {
	x: number;
	y: number;
}

export interface ChampionKillEvent {
	type: "CHAMPION_KILL";
	timestamp: number; // ms
	killerId: number; // 0 = executed by minions/turret
	victimId: number;
	assistingParticipantIds?: number[];
	position: MapPosition;
}

export interface BuildingKillEvent {
	type: "BUILDING_KILL";
	timestamp: number;
	buildingType: string; // TOWER_BUILDING | INHIBITOR_BUILDING
	/** Team that OWNED the destroyed building. */
	teamId: number;
	position: MapPosition;
}

export type TimelineEvent =
	| ChampionKillEvent
	| BuildingKillEvent
	| { type: string; timestamp: number };

export interface Timeline {
	info: {
		participants: { participantId: number; puuid: string }[];
		frames: { timestamp: number; events: TimelineEvent[] }[];
	};
}
