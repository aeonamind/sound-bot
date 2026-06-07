import type { GuildNodeCreateOptions } from "discord-player";

export const defaultNodeOptions: GuildNodeCreateOptions = {
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: 60_000,
	leaveOnEnd: true,
	leaveOnEndCooldown: 60_000,
	selfDeaf: true,
	bufferingTimeout: 0,
	connectionTimeout: 30_000,
};
