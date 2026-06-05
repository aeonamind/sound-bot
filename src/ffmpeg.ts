import { spawnSync } from "node:child_process";
import { FFmpeg, type ResolvedFFmpegSource } from "@discord-player/ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const VERSION_REGEX = /version (.+) Copyright/im;

/**
 * Resolves ffmpeg and seeds @discord-player/ffmpeg's cache.
 * The library's built-in resolve() probes with `-v` and reads stdout, which
 * breaks under Bun when the binary is missing or stdout is null.
 */
export function initFfmpeg(): string {
	const candidates = [
		process.env.FFMPEG_PATH,
		"/usr/bin/ffmpeg",
		ffmpegStatic,
	].filter((p): p is string => Boolean(p));

	for (const path of candidates) {
		const result = spawnSync(path, ["-version"], { windowsHide: true });
		if (result.error || result.status !== 0) continue;

		const output = (result.stdout ?? result.stderr)?.toString() ?? "";
		if (!VERSION_REGEX.test(output)) continue;

		const resolved: ResolvedFFmpegSource = {
			result: output,
			command: path,
			module: false,
			name: "ffmpeg",
			path,
			version: VERSION_REGEX.exec(output)?.[1] ?? "unknown",
		};

		(FFmpeg as unknown as { cached: ResolvedFFmpegSource | null }).cached =
			resolved;
		process.env.FFMPEG_PATH = path;
		return path;
	}

	throw new Error(
		"Could not find a working ffmpeg binary. Install ffmpeg or set FFMPEG_PATH.",
	);
}
