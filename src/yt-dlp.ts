import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import type { Flags } from "youtube-dl-exec";
import youtubedlDefault, { create as createYoutubeDl } from "youtube-dl-exec";

type YtDlpFlags = Flags & {
	extractorArgs?: string;
	fragmentRetries?: number;
	httpChunkSize?: string;
};

const DEFAULT_COOKIE_PATHS = [
	"/secrets/youtube-cookies.txt",
	"/app/secrets/youtube-cookies.txt",
] as const;
const WRITABLE_COOKIES_PATH = "/tmp/youtube-cookies.txt";
const YT_DLP_CACHE_DIR = "/tmp/yt-dlp-cache";
const YT_DLP_JS_RUNTIME = "bun:/usr/local/bin/bun";

let resolvedCookiesFile: string | null | undefined;
let writableCookiesFile: string | null | undefined;
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

function resolveWritableCookiesFile(): string | null {
	if (writableCookiesFile !== undefined) return writableCookiesFile;

	const source = resolveCookiesFile();
	if (!source) {
		writableCookiesFile = null;
		return null;
	}

	try {
		copyFileSync(source, WRITABLE_COOKIES_PATH);
		writableCookiesFile = WRITABLE_COOKIES_PATH;
		return WRITABLE_COOKIES_PATH;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(
			`yt-dlp: failed to copy cookies to writable path (${message}), using source file`,
		);
		writableCookiesFile = source;
		return source;
	}
}

function buildExtractorArgs(): string {
	if (process.env.YT_DLP_EXTRACTOR_ARGS?.trim()) {
		return process.env.YT_DLP_EXTRACTOR_ARGS.trim();
	}

	const clients = resolveCookiesFile()
		? "web_safari"
		: "android_vr,web_embedded";
	const parts = [`player-client=${clients}`];
	const poToken = process.env.YT_DLP_PO_TOKEN?.trim();
	if (poToken) parts.push(`po_token=web+${poToken}`);

	return `youtube:${parts.join(";")}`;
}

export function getYtDlpStreamFlags(): YtDlpFlags {
	const flags: YtDlpFlags = {
		// HTTPS progressive audio only — never fall back to DASH/HLS (stutters when piped).
		format:
			"ba[protocol=https]/bestaudio[protocol=https]/best[format_id=18]/best[ext=mp4][protocol=https]",
		output: "-",
		noPart: true,
		quiet: true,
		noWarnings: true,
		retries: 10,
		fragmentRetries: 10,
		skipUnavailableFragments: true,
		httpChunkSize: "10M",
		extractorArgs: buildExtractorArgs(),
		remoteComponent: "ejs:github",
		jsRuntimes: YT_DLP_JS_RUNTIME,
		cacheDir: YT_DLP_CACHE_DIR,
	};

	const cookiesFile = resolveWritableCookiesFile();
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

export function logYtDlpConfig(): void {
	mkdirSync(YT_DLP_CACHE_DIR, { recursive: true });

	const cookiesFile = resolveCookiesFile();
	const writableCookies = resolveWritableCookiesFile();
	const extractorArgs = buildExtractorArgs();

	console.log(`yt-dlp extractor args: ${extractorArgs}`);
	console.log(`yt-dlp js runtime: ${YT_DLP_JS_RUNTIME}`);

	if (cookiesFile) {
		console.log(`yt-dlp cookies: ${cookiesFile}`);
		if (writableCookies && writableCookies !== cookiesFile) {
			console.log(`yt-dlp cookies (writable): ${writableCookies}`);
		}
		return;
	}

	if (!process.env.YT_DLP_PATH) return;

	const expectedPath =
		process.env.YT_DLP_COOKIES_FILE ?? "/secrets/youtube-cookies.txt";

	console.warn(
		`yt-dlp: no cookies file found (expected at ${expectedPath}) — YouTube may block datacenter IPs; play-dl fallback will be used`,
	);
}
