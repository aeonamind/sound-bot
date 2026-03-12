import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	type GuildMember,
	SlashCommandBuilder,
} from "discord.js";
import { QueryType, useMainPlayer, useQueue } from "discord-player";
import type { Command } from "../../interfaces";

const command: Command = {
	data: new SlashCommandBuilder()
		.setName("music")
		.setDescription("Music player commands")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("play")
				.setDescription("Play a song from YouTube")
				.addStringOption((option) =>
					option
						.setName("query")
						.setDescription("Song name or URL")
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("volume")
				.setDescription("Adjust the volume")
				.addNumberOption((option) =>
					option
						.setName("percent")
						.setDescription("Volume percentage (1-100)")
						.setMinValue(1)
						.setMaxValue(100)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("queue").setDescription("Show the current queue"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("skip").setDescription("Skip the current song"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("pause").setDescription("Pause the current song"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("resume").setDescription("Resume the current song"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("stop")
				.setDescription("Stop the music and clear queue"),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("nowplaying")
				.setDescription("Show the currently playing song"),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName("shuffle").setDescription("Shuffle the queue"),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const member = interaction.member as GuildMember;
		const subcommand = interaction.options.getSubcommand();

		// Check if user is in a voice channel
		const voiceChannel = member?.voice?.channel;
		if (!voiceChannel) {
			return interaction.reply({
				content: "❌ You must be in a voice channel to use music commands!",
				ephemeral: true,
			});
		}

		const player = useMainPlayer();
		const queue = useQueue(interaction.guildId!);

		try {
			switch (subcommand) {
				case "play": {
					await interaction.deferReply();

					const query = interaction.options.getString("query", true);

					const result = await player.search(query, {
						requestedBy: interaction.user,
						searchEngine: QueryType.AUTO,
					});

					if (!result || !result.tracks.length) {
						return interaction.editReply({
							content: "❌ No results found!",
						});
					}

					try {
						const { track } = await player.play(voiceChannel, result, {
							nodeOptions: {
								metadata: {
									channel: interaction.channel,
									client: interaction.client,
									requestedBy: interaction.user,
								},
								leaveOnEmptyCooldown: 60000,
								leaveOnEndCooldown: 60000,
								leaveOnEmpty: true,
								leaveOnEnd: true,
								bufferingTimeout: 0,
								selfDeaf: true,
							},
						});

						return interaction.editReply({
							content: `🎵 | Loading: **${track.title}**`,
						});
					} catch (error) {
						console.error("Play error:", error);
						return interaction.editReply({
							content: "❌ Could not play this track!",
						});
					}
				}

				case "volume": {
					if (!queue || !queue.isPlaying()) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					const volume = interaction.options.getNumber("percent", true);
					queue.node.setVolume(volume);

					return interaction.reply({
						content: `🔊 | Volume set to **${volume}%**`,
					});
				}

				case "queue": {
					if (!queue || !queue.tracks.size) {
						return interaction.reply({
							content: "📭 | The queue is empty.",
							ephemeral: true,
						});
					}

					const currentTrack = queue.currentTrack;
					const tracks = queue.tracks.toArray();

					const embed = new EmbedBuilder()
						.setColor("Purple")
						.setTitle("🎶 Current Queue")
						.setDescription(
							`**Now Playing:**\n${currentTrack ? `${currentTrack.title} - \`${currentTrack.duration}\`` : "Nothing"}\n\n` +
								`**Up Next:**\n${
									tracks
										.slice(0, 10)
										.map(
											(track, i) =>
												`**${i + 1}.** ${track.title} - \`${track.duration}\``,
										)
										.join("\n") || "Nothing in queue"
								}` +
								(tracks.length > 10
									? `\n... and ${tracks.length - 10} more`
									: ""),
						)
						.setFooter({
							text: `Total tracks: ${tracks.length + (currentTrack ? 1 : 0)}`,
						});

					return interaction.reply({ embeds: [embed] });
				}

				case "skip": {
					if (!queue || !queue.isPlaying()) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					const currentTrack = queue.currentTrack;
					queue.node.skip();

					return interaction.reply({
						content: `⏭️ | Skipped: **${currentTrack?.title}**`,
					});
				}

				case "pause": {
					if (!queue || !queue.isPlaying()) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					queue.node.pause();

					return interaction.reply({
						content: "⏸️ | Paused!",
					});
				}

				case "resume": {
					if (!queue) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					queue.node.resume();

					return interaction.reply({
						content: "▶️ | Resumed!",
					});
				}

				case "stop": {
					if (!queue) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					queue.delete();

					return interaction.reply({
						content: "⏹️ | Stopped and cleared the queue!",
					});
				}

				case "nowplaying": {
					if (!queue || !queue.currentTrack) {
						return interaction.reply({
							content: "❌ No music is being played!",
							ephemeral: true,
						});
					}

					const track = queue.currentTrack;
					const progress = queue.node.createProgressBar();

					const embed = new EmbedBuilder()
						.setColor("Blue")
						.setTitle("🎵 Now Playing")
						.setDescription(`**${track.title}**\nby ${track.author}`)
						.addFields(
							{ name: "Duration", value: track.duration, inline: true },
							{
								name: "Requested by",
								value: `${track.requestedBy}`,
								inline: true,
							},
						)
						.setThumbnail(track.thumbnail)
						.setFooter({ text: progress || "No progress available" });

					return interaction.reply({ embeds: [embed] });
				}

				case "shuffle": {
					if (!queue || !queue.tracks.size) {
						return interaction.reply({
							content: "❌ No tracks in queue to shuffle!",
							ephemeral: true,
						});
					}

					queue.tracks.shuffle();

					return interaction.reply({
						content: "🔀 | Queue shuffled!",
					});
				}

				default:
					return interaction.reply({
						content: "❌ Unknown subcommand.",
						ephemeral: true,
					});
			}
		} catch (error) {
			console.error("Music command error:", error);

			if (interaction.deferred) {
				return interaction.editReply({
					content: "❌ An error occurred while executing the command.",
				});
			}

			return interaction.reply({
				content: "❌ An error occurred while executing the command.",
				ephemeral: true,
			});
		}
	},
};

export = command;
