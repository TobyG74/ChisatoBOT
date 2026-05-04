import type { ConfigCommands } from "../../types/structure/commands";
import {
    fetchMangaRanking,
    formatMangaInfo,
    VALID_MANGA_TYPES,
} from "../../utils/scrapers/anime";
import axios from "axios";

export default {
    name: "mangaranking",
    alias: ["mangarank", "malmangaranking", "topmanga"],
    category: "anime",
    description: "Looks for Top Ranked Manga on MyAnimeList",
    usage: "[type]",
    cooldown: 5,
    limit: 2,
    async run({ Chisato, from, message, args }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        const type = (args[0] || "manga") as MangaType;

        if (!VALID_MANGA_TYPES.includes(type)) {
            await Chisato.sendReaction(from, "❌", message.key);
            return await Chisato.sendText(
                from,
                `❌ *Invalid type!*\n\nValid types are:\n${VALID_MANGA_TYPES.join(
                    ", "
                )}`,
                message
            );
        }

        try {
            const response = await fetchMangaRanking(type, 10);
            const { data } = response;

            // Sort by rank (ascending)
            const sortedData = data.sort((a, b) => a.rank - b.rank);

            Chisato.logger.info(`Fetched ${sortedData.length} manga for type "${type}" from MAL ranking.`);

            const cards = [];
            for (const manga of sortedData) {
                if (!manga || !manga.title || !manga.images) {
                    Chisato.logger.error(`Invalid manga data found, skipping: ${JSON.stringify(manga)}`);
                    continue;
                }

                const mangaTitle = manga.title;
                const mangaRank = manga.rank;
                const mangaScore = manga.score;
                const mangaScoredBy = manga.scored_by;
                const mangaUrl =
                    manga.url ||
                    `https://myanimelist.net/manga/${manga.mal_id}`;
                const imageUrl =
                    manga.images.jpg.large_image_url ||
                    manga.images.jpg.image_url;

                let imageBuffer: Buffer;
                try {
                    const response = await axios.get(imageUrl, {
                        responseType: "arraybuffer",
                    });
                    imageBuffer = Buffer.from(response.data);
                } catch (error) {
                    Chisato.logger.error(
                        `Failed to download image for ${mangaTitle}:`,
                        error
                    );
                    imageBuffer = Buffer.alloc(0);
                }

                const rankMedal =
                    mangaRank === 1
                        ? "🥇"
                        : mangaRank === 2
                        ? "🥈"
                        : mangaRank === 3
                        ? "🥉"
                        : `#${mangaRank}`;

                cards.push({
                    header: imageBuffer,
                    title: `${rankMedal} ${mangaTitle}`,
                    body: formatMangaInfo(manga).substring(0, 500) + "...",
                    footer: `⭐ ${mangaScore}/10 • 👥 ${mangaScoredBy.toLocaleString()} votes`,
                    buttons: [],
                });
            }

            const builder = new (Chisato as any).TemplateBuilder.Carousel(
                Chisato
            );

            cards.forEach((card, index) => {
                const manga = sortedData[index];
                if (manga && manga.url) {
                    card.buttons = [
                        builder.button.url({
                            display: "View on MAL",
                            url:
                                manga.url ||
                                `https://myanimelist.net/manga/${manga.mal_id}`,
                        }),
                    ];
                }
            });

            Chisato.logger.info("Carousel message generated, sending...");

            const builtMessage = await builder
                .mainBody(
                    `📚 *MyAnimeList Ranking - ${type.toUpperCase()}*\n\nTop ${
                        sortedData.length
                    } manga sorted by ranking`
                )
                .mainFooter("Powered by MyAnimeList API")
                .mainHeader("Manga Ranking")
                .cards(cards)
                .render();

            await (Chisato as any).relayMessage(from, builtMessage.message, {
                messageId: builtMessage.key.id,
            });
            await Chisato.sendReaction(from, "✅", message.key);

            Chisato.logger.info("Carousel sent successfully!");
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error("Error fetching MAL manga ranking:", error);

            let errorMessage = "❌ *Error!*\n\n";

            if (error.response?.status === 429) {
                errorMessage += "Too many requests! Please wait and try again.";
            } else if (error.response?.status === 404) {
                errorMessage += "Page not found!";
            } else {
                errorMessage += `Failed to fetch manga ranking!\n\nError: ${error.message}`;
            }

            await Chisato.sendText(from, errorMessage, message);
        }
    },
} satisfies ConfigCommands;