import type { Player, Track } from "discord-player";
import { PlayDLExtractor } from "./bot/extractors/play-dl";

export const SOUNDCLOUD_EXTRACTOR_ID =
	"com.discord-player.soundcloudextractor" as const;

const fallbackUsed = new WeakMap<Track, string[]>();

export function isYoutubeStreamError(error: Error): boolean {
	const stderr = (error as { stderr?: string }).stderr ?? "";
	const msg = `${error.message}\n${stderr}`.toLowerCase();

	return (
		msg.includes("yt-dlp") ||
		msg.includes("youtube") ||
		msg.includes("childprocesserror") ||
		msg.includes("sign in to confirm") ||
		msg.includes("not a bot") ||
		msg.includes("cookies are no longer valid") ||
		msg.includes("could not extract stream")
	);
}

export function isYoutubeBackedTrack(track: Track): boolean {
	const youtubeId = PlayDLExtractor.identifier;
	return (
		track.bridgedExtractor?.identifier === youtubeId ||
		(track.extractor?.identifier === youtubeId && !track.bridgedExtractor)
	);
}

export function hasUsedFallback(track: Track, source: string): boolean {
	return (fallbackUsed.get(track) ?? []).includes(source);
}

function markFallbackUsed(track: Track, source: string): void {
	const used = fallbackUsed.get(track) ?? [];
	if (!used.includes(source)) used.push(source);
	fallbackUsed.set(track, used);
}

export async function trySoundCloudBridge(
	player: Player,
	track: Track,
): Promise<boolean> {
	if (hasUsedFallback(track, "soundcloud")) return false;

	const soundcloud = player.extractors.resolve(SOUNDCLOUD_EXTRACTOR_ID);
	if (!soundcloud) return false;

	markFallbackUsed(track, "soundcloud");
	track.bridgedTrack = null;
	track.bridgedExtractor = null;

	try {
		const stream = await player.extractors.requestBridgeFrom(
			track,
			track.extractor ?? undefined,
			soundcloud,
		);
		return stream != null;
	} catch {
		return false;
	}
}
