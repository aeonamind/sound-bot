import { existsSync } from "node:fs";
import type { Readable } from "node:stream";
import {
	BaseExtractor,
	type ExtractorInfo,
	type ExtractorSearchContext,
	type ExtractorStreamable,
	type GuildQueueHistory,
	QueryType,
	type SearchQueryType,
	Track,
	Util,
} from "discord-player";
import play from "play-dl";
import youtubedlDefault, { create as createYoutubeDl } from "youtube-dl-exec";

function resolveYoutubeDl() {
	const candidates = [process.env.YT_DLP_PATH, "/usr/local/bin/yt-dlp"].filter(
		(path): path is string => Boolean(path),
	);

	for (const path of candidates) {
		if (existsSync(path)) return createYoutubeDl(path);
	}

	return youtubedlDefault;
}

const youtubedl = resolveYoutubeDl();

type BridgeSource = {
	identifier: string;
	createBridgeQuery?: (track: Track) => string;
};

export class PlayDLExtractor extends BaseExtractor {
	static identifier = "com.soundbot.playdl-extractor" as const;

	async activate(): Promise<void> {
		this.protocols = ["ytsearch", "youtube"];
	}

	async validate(
		query: string,
		type?: SearchQueryType | null,
	): Promise<boolean> {
		if (typeof query !== "string" || !query.trim()) return false;

		const ytResult = play.yt_validate(query);
		if (ytResult === "video" || ytResult === "playlist") return true;

		return (
			type === QueryType.YOUTUBE ||
			type === QueryType.YOUTUBE_SEARCH ||
			type === QueryType.AUTO ||
			type === QueryType.AUTO_SEARCH
		);
	}

	async handle(
		query: string,
		context: ExtractorSearchContext,
	): Promise<ExtractorInfo> {
		const ytResult = play.yt_validate(query);

		if (ytResult === "video") {
			return this.handleVideoURL(query, context);
		}

		return this.handleSearch(query, context);
	}

	private async handleVideoURL(
		url: string,
		context: ExtractorSearchContext,
	): Promise<ExtractorInfo> {
		try {
			const { video_details: v } = await play.video_basic_info(url);
			const track = this.buildTrack(
				{
					title: v.title ?? "Unknown",
					description: v.description ?? "",
					author: v.channel?.name ?? "Unknown",
					url: v.url,
					thumbnail: v.thumbnails[0]?.url ?? "",
					durationRaw: Util.buildTimeCode(
						Util.parseMS(v.durationInSec * 1_000),
					),
					views: v.views ?? 0,
					live: v.live,
				},
				context,
				QueryType.YOUTUBE,
			);
			return this.createResponse(null, [track]);
		} catch {
			return this.createResponse();
		}
	}

	private async handleSearch(
		query: string,
		context: ExtractorSearchContext,
	): Promise<ExtractorInfo> {
		try {
			const results = await play.search(query, {
				source: { youtube: "video" },
				limit: 5,
			});

			const tracks = results.map((v) =>
				this.buildTrack(
					{
						title: v.title ?? "Unknown",
						description: v.description ?? "",
						author: v.channel?.name ?? "Unknown",
						url: v.url,
						thumbnail: v.thumbnails[0]?.url ?? "",
						durationRaw: v.durationRaw ?? "0:00",
						views: v.views ?? 0,
						live: v.live,
					},
					context,
					QueryType.YOUTUBE_SEARCH,
				),
			);

			return this.createResponse(null, tracks);
		} catch {
			return this.createResponse();
		}
	}

	private buildTrack(
		data: {
			title: string;
			description: string;
			author: string;
			url: string;
			thumbnail: string;
			durationRaw: string;
			views: number;
			live: boolean;
		},
		context: ExtractorSearchContext,
		queryType: SearchQueryType,
	): Track {
		const track = new Track(this.context.player, {
			title: data.title,
			description: data.description,
			author: data.author,
			url: data.url,
			thumbnail: data.thumbnail,
			duration: data.durationRaw,
			views: data.views,
			live: data.live,
			source: "youtube",
			requestedBy: context.requestedBy,
			queryType,
		});
		track.extractor = this;
		return track;
	}

	private createYtDlpStream(youtubeUrl: string): Readable {
		const subprocess = youtubedl.exec(youtubeUrl, {
			format: "ba/b",
			output: "-",
			noPart: true,
			quiet: true,
			noWarnings: true,
		});

		const stream = subprocess.stdout as Readable;

		stream.on("error", () => {
			if (!subprocess.killed) subprocess.kill("SIGKILL");
		});

		stream.on("close", () => {
			if (!subprocess.killed) subprocess.kill("SIGKILL");
		});

		return stream;
	}

	async stream(track: Track): Promise<ExtractorStreamable> {
		const url = track.bridgedTrack?.url ?? track.url;
		if (!url || play.yt_validate(url) !== "video") {
			throw new Error(`Cannot stream non-YouTube URL: ${url ?? "undefined"}`);
		}

		return this.createYtDlpStream(url);
	}

	async bridge(
		track: Track,
		sourceExtractor: BridgeSource | null,
	): Promise<ExtractorStreamable | null> {
		if (sourceExtractor?.identifier === PlayDLExtractor.identifier) {
			return this.stream(track);
		}

		const query =
			sourceExtractor?.createBridgeQuery?.(track) ??
			`${track.author} - ${track.title}`;

		try {
			const results = await play.search(query, {
				source: { youtube: "video" },
				limit: 1,
			});

			const video = results[0];
			if (!video?.url || play.yt_validate(video.url) !== "video") return null;

			const bridgedTrack = this.buildTrack(
				{
					title: video.title ?? "Unknown",
					description: video.description ?? "",
					author: video.channel?.name ?? "Unknown",
					url: video.url,
					thumbnail: video.thumbnails[0]?.url ?? "",
					durationRaw: video.durationRaw ?? "0:00",
					views: video.views ?? 0,
					live: video.live,
				},
				{ requestedBy: track.requestedBy },
				QueryType.YOUTUBE_SEARCH,
			);

			track.bridgedTrack = bridgedTrack;
			track.bridgedExtractor = this;

			return this.createYtDlpStream(video.url);
		} catch {
			return null;
		}
	}

	emptyResponse(): ExtractorInfo {
		return this.createResponse(null, []);
	}

	async getRelatedTracks(
		_track: Track,
		_history: GuildQueueHistory,
	): Promise<ExtractorInfo> {
		return this.createResponse();
	}
}
