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

	async stream(track: Track): Promise<ExtractorStreamable> {
		const ytStream = await play.stream(track.url, { quality: 2 });
		return ytStream.stream;
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
