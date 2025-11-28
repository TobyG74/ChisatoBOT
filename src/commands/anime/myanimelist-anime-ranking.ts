import type { ConfigCommands } from "../../types/structure/commands";
import {
    fetchAnimeRanking,
    formatAnimeInfo,
    VALID_ANIME_TYPES,
} from "../../utils/scrapers/anime";
import axios from "axios";

export default {
    name: "animeranking",
    alias: ["malanimerank", "malanimeranking", "topanime"],
    category: "anime",
    description: "Looks for Top Ranked Anime on MyAnimeList",
    usage: "<type>",
    cooldown: 5,
    limit: 2,
    async run({ Chisato, from, message, args }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        const type = (args[0] || "tv") as AnimeType;

        if (!VALID_ANIME_TYPES.includes(type)) {
            await Chisato.sendReaction(from, "❌", message.key);
            return await Chisato.sendText(
                from,
                `❌ *Invalid type!*\n\nValid types are:\n${VALID_ANIME_TYPES.join(
                    ", "
                )}`,
                message
            );
        }

        try {
            const response = await fetchAnimeRanking(type, 10);
            const { data } = response;

            // Sort by rank (ascending)
            const sortedData = data.sort((a, b) => a.rank - b.rank);

            console.log(
                `Preparing carousel with ${sortedData.length} cards...`
            );

            const cards = [];
            for (const anime of sortedData) {
                if (!anime || !anime.title || !anime.images) {
                    console.error("Invalid anime data found, skipping:", anime);
                    continue;
                }

                const animeTitle = anime.title;
                const animeRank = anime.rank;
                const animeScore = anime.score;
                const animeScoredBy = anime.scored_by;
                const animeUrl =
                    anime.url ||
                    `https://myanimelist.net/anime/${anime.mal_id}`;
                const imageUrl =
                    anime.images.jpg.large_image_url ||
                    anime.images.jpg.image_url;

                let imageBuffer: Buffer;
                try {
                    const response = await axios.get(imageUrl, {
                        responseType: "arraybuffer",
                    });
                    imageBuffer = Buffer.from(response.data);
                } catch (error) {
                    console.error(
                        `Failed to download image for ${animeTitle}:`,
                        error
                    );
                    imageBuffer = Buffer.alloc(0);
                }

                const rankMedal =
                    animeRank === 1
                        ? "🥇"
                        : animeRank === 2
                        ? "🥈"
                        : animeRank === 3
                        ? "🥉"
                        : `#${animeRank}`;

                cards.push({
                    header: imageBuffer,
                    title: `${rankMedal} ${animeTitle}`,
                    body: formatAnimeInfo(anime).substring(0, 500) + "...",
                    footer: `⭐ ${animeScore}/10 • 👥 ${animeScoredBy.toLocaleString()} votes`,
                    buttons: [],
                });
            }

            const builder = new (Chisato as any).TemplateBuilder.Carousel(
                Chisato
            );

            cards.forEach((card, index) => {
                const anime = sortedData[index];
                if (anime && anime.url) {
                    card.buttons = [
                        builder.button.url({
                            display: "View on MAL",
                            url:
                                anime.url ||
                                `https://myanimelist.net/anime/${anime.mal_id}`,
                        }),
                    ];
                }
            });

            console.log("Carousel message generated, sending...");

            const builtMessage = await builder
                .mainBody(
                    `📊 *MyAnimeList Ranking - ${type.toUpperCase()}*\n\nTop ${
                        sortedData.length
                    } anime sorted by ranking`
                )
                .mainFooter("Powered by MyAnimeList API")
                .mainHeader("Anime Ranking")
                .cards(cards)
                .render();

            await (Chisato as any).relayMessage(from, builtMessage.message, {
                messageId: builtMessage.key.id,
            });
            await Chisato.sendReaction(from, "✅", message.key);

            console.log("Carousel sent successfully!");
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            console.error("Error fetching MAL ranking:", error);

            let errorMessage = "❌ *Error!*\n\n";

            if (error.response?.status === 429) {
                errorMessage += "Too many requests! Please wait and try again.";
            } else if (error.response?.status === 404) {
                errorMessage += "Page not found!";
            } else {
                errorMessage += `Failed to fetch anime ranking!\n\nError: ${error.message}`;
            }

            await Chisato.sendText(from, errorMessage, message);
        }
    },
} satisfies ConfigCommands;