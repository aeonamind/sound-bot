import { existsSync } from "node:fs";
import type { Flags } from "youtube-dl-exec";
import youtubedlDefault, { create as createYoutubeDl } from "youtube-dl-exec";

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

export function getYtDlpStreamFlags(): Flags {
	const flags: Flags = {
		format: "ba/b",
		output: "-",
		noPart: true,
		quiet: true,
		noWarnings: true,
	};

	const cookiesFile = resolveCookiesFile();
	if (cookiesFile) flags.cookies = cookiesFile;

	return flags;
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

	if (cookiesFile) {
		console.log(`yt-dlp cookies: ${cookiesFile}`);
		return;
	}

	if (!process.env.YT_DLP_PATH) return;

	const expectedPath =
		process.env.YT_DLP_COOKIES_FILE ?? "/secrets/youtube-cookies.txt";

	console.warn(
		`yt-dlp: no cookies file found (expected at ${expectedPath}) — YouTube may block datacenter IPs`,
	);
}
