import { existsSync, readFileSync } from "node:fs";
import type { Flags } from "youtube-dl-exec";
import youtubedlDefault, { create as createYoutubeDl } from "youtube-dl-exec";

type YtDlpFlags = Flags & { extractorArgs?: string };

const DEFAULT_COOKIE_PATHS = [
	"/secrets/youtube-cookies.txt",
	"/app/secrets/youtube-cookies.txt",
] as const;

let resolvedCookiesFile: string | null | undefined;
let youtubeDlInstance:
	| ReturnType<typeof createYoutubeDl>
	| typeof youtubedlDefault;

export function resolveYoutubeDl() {
	if (youtubeDlInstance) return youtubeDlInstance;

	const candidates = [process.env.YT_DLP_PATH, "/usr/local/bin/yt-dlp"].filter(
		(path): path is string => Boolean(path),
	);

	for (const path of candidates) {
		if (existsSync(path)) {
			youtubeDlInstance = createYoutubeDl(path);
			return youtubeDlInstance;
		}
	}

	youtubeDlInstance = youtubedlDefault;
	return youtubeDlInstance;
}

export function resolveCookiesFile(): string | null {
	if (resolvedCookiesFile !== undefined) return resolvedCookiesFile;

	const candidates = [
		process.env.YT_DLP_COOKIES_FILE,
		...DEFAULT_COOKIE_PATHS,
		`${process.cwd()}/youtube-cookies.txt`,
		`${process.cwd()}/secrets/youtube-cookies.txt`,
	].filter((path): path is string => Boolean(path));

	for (const path of [...new Set(candidates)]) {
		if (existsSync(path)) {
			resolvedCookiesFile = path;
			return path;
		}
	}

	resolvedCookiesFile = null;
	return null;
}

function buildExtractorArgs(): string {
	if (process.env.YT_DLP_EXTRACTOR_ARGS?.trim()) {
		return process.env.YT_DLP_EXTRACTOR_ARGS.trim();
	}

	const parts = ["player-client=android_vr,web_embedded,tv"];
	const poToken = process.env.YT_DLP_PO_TOKEN?.trim();
	if (poToken) parts.push(`po_token=web+${poToken}`);

	return `youtube:${parts.join(";")}`;
}

export function getYtDlpStreamFlags(): YtDlpFlags {
	const flags: YtDlpFlags = {
		format: "ba/b",
		output: "-",
		noPart: true,
		quiet: true,
		noWarnings: true,
		extractorArgs: buildExtractorArgs(),
		remoteComponent: "ejs:github",
	};

	const cookiesFile = resolveCookiesFile();
	if (cookiesFile) flags.cookies = cookiesFile;

	return flags;
}

export function loadYoutubeCookieHeader(): string | null {
	const cookiesFile = resolveCookiesFile();
	if (!cookiesFile) return null;

	try {
		const cookies: string[] = [];

		for (const line of readFileSync(cookiesFile, "utf8").split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;

			const parts = trimmed.split("\t");
			if (parts.length < 7) continue;

			const domain = parts[0] ?? "";
			if (!domain.includes("youtube.com") && !domain.includes("google.com")) {
				continue;
			}

			const name = parts[5];
			const value = parts[6];
			if (name && value) cookies.push(`${name}=${value}`);
		}

		return cookies.length > 0 ? cookies.join("; ") : null;
	} catch {
		return null;
	}
}

export async function verifyYtDlpUrl(url: string): Promise<boolean> {
	try {
		await resolveYoutubeDl()(url, {
			...getYtDlpStreamFlags(),
			simulate: true,
			skipDownload: true,
		});
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`yt-dlp preflight failed: ${message}`);
		return false;
	}
}

export function logYtDlpConfig(): void {
	const cookiesFile = resolveCookiesFile();
	const extractorArgs = buildExtractorArgs();

	console.log(`yt-dlp extractor args: ${extractorArgs}`);

	if (cookiesFile) {
		console.log(`yt-dlp cookies: ${cookiesFile}`);
		return;
	}

	if (!process.env.YT_DLP_PATH) return;

	const expectedPath =
		process.env.YT_DLP_COOKIES_FILE ?? "/secrets/youtube-cookies.txt";

	console.warn(
		`yt-dlp: no cookies file found (expected at ${expectedPath}) — YouTube may block datacenter IPs; play-dl fallback will be used`,
	);
}
