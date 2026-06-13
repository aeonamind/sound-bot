import type { GuildNodeCreateOptions } from "discord-player";

/** FFmpeg input tuning for piped yt-dlp streams (smooth playback, not ultra-low probe). */
export const ffmpegInputArgs = [
	"-probesize",
	"32768",
	"-analyzeduration",
	"500000",
	"-fflags",
	"+genpts",
	"-thread_queue_size",
	"512",
] as const;

export const defaultNodeOptions: GuildNodeCreateOptions = {
	leaveOnEmpty: true,
	leaveOnEmptyCooldown: 60_000,
	leaveOnEnd: true,
	leaveOnEndCooldown: 60_000,
	selfDeaf: true,
	bufferingTimeout: 10_000,
	connectionTimeout: 30_000,
};
