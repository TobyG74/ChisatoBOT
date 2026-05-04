import type { ConfigCommands } from "../../types/structure/commands";
import { TraceMoeScraper } from "../../utils/scrapers/anime";
import { toVideoMP4 } from "../../utils/converter";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

export default {
    name: "tracemoe",
    alias: ["whatanime", "trace", "animesearch"],
    category: "anime",
    description: "Search anime from image/screenshot using trace.moe",
    usage: "[reply image | image url]",
    cooldown: 5,
    limit: 2,
    async run({ Chisato, message, args, from, prefix }) {
        const scraper = new TraceMoeScraper();

        try {
            let imageBuffer: Buffer | null = null;
            let imageUrl: string | null = null;

            if (message.quoted && message.quoted.type === "imageMessage") {
                const quoted = message.quoted
                if (quoted) {
                    try {
                        const baileys = await (async () => {
                            const dynamicImport = new Function('specifier', 'return import(specifier)');
                            return await dynamicImport("baileys");
                        })();
                        const { downloadContentFromMessage, toBuffer } = baileys;

                        const stream = await downloadContentFromMessage(
                            quoted.message.imageMessage,
                            "image"
                        );
                        imageBuffer = await toBuffer(stream);
                    } catch (error) {
                        return Chisato.sendText(
                            from,
                            "❌ Failed to download image. Please try again.",
                            message
                        );
                    }
                }
            } else if (message.message?.imageMessage) {
                imageBuffer = await Chisato.downloadMediaMessage(message);
            } else if (args.length > 0 && /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i.test(args[0])) {
                imageUrl = args[0];
            } else {
                let text = `*「 TRACE.MOE - ANIME SEARCH 」*\n\n`;
                text += `🔍 Search anime from image or screenshot!\n\n`;
                text += `📝 *How to use:*\n`;
                text += `1️⃣ Reply to an image with ${prefix}tracemoe\n`;
                text += `2️⃣ Send image with caption ${prefix}tracemoe\n`;
                text += `3️⃣ ${prefix}tracemoe [image url]\n\n`;
                text += `💡 *Example:*\n`;
                text += `• ${prefix}tracemoe (reply to anime screenshot)\n`;
                text += `• ${prefix}tracemoe https://example.com/anime.jpg\n\n`;
                text += `✨ Powered by trace.moe`;
                return Chisato.sendText(from, text, message);
            }

            let result;
            if (imageBuffer) {
                result = await scraper.searchByImage(imageBuffer);
            } else if (imageUrl) {
                result = await scraper.searchByUrl(imageUrl);
            } else {
                return Chisato.sendText(
                    from,
                    "❌ No image provided. Please reply to an image or provide an image URL.",
                    message
                );
            }

            if (!result.result || result.result.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ No anime found matching this image. Try with a clearer screenshot or different scene.",
                    message
                );
            }

            const topResults = result.result.slice(0, 5);
            
            await Chisato.sendReaction(from, "✅", message.key);

            const cards = [];
            
            for (let i = 0; i < topResults.length; i++) {
                const match = topResults[i];
                const similarity = scraper.formatSimilarity(match.similarity);

                let anilistInfo;
                try {
                    anilistInfo = await scraper.getAnilistInfo(match.anilist);
                } catch (error) {
                    // Continue without anilist info
                }

                let bodyText = `📊 *Similarity:* ${similarity}\n`;
                
                if (match.episode) {
                    bodyText += `📺 *Episode:* ${match.episode}\n`;
                }
                
                bodyText += `⏱️ *Time:* ${scraper.formatTime(match.from)} - ${scraper.formatTime(match.to)}\n`;

                if (anilistInfo) {
                    bodyText += `\n🎌 *Japanese:* ${anilistInfo.title.native}\n`;
                    if (anilistInfo.title.english && anilistInfo.title.english !== anilistInfo.title.romaji) {
                        bodyText += `🌐 *English:* ${anilistInfo.title.english}`;
                    }
                }

                const cardButtons = [];

                if (anilistInfo) {
                    cardButtons.push({
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "View on Anilist",
                            url: `https://anilist.co/anime/${anilistInfo.id}`,
                            merchant_url: `https://anilist.co/anime/${anilistInfo.id}`
                        })
                    });

                    if (anilistInfo.idMal) {
                        cardButtons.push({
                            name: "cta_url",
                            buttonParamsJson: JSON.stringify({
                                display_text: "View on MyAnimeList",
                                url: `https://myanimelist.net/anime/${anilistInfo.idMal}`,
                                merchant_url: `https://myanimelist.net/anime/${anilistInfo.idMal}`
                            })
                        });
                    }
                }

                if (match.video) {
                    cardButtons.push({
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: "Watch Preview",
                            url: match.video,
                            merchant_url: match.video
                        })
                    });
                }

                let videoBuffer: Buffer | null = null;
                if (match.video) {
                    try {
                        videoBuffer = await toVideoMP4(match.video);
                    } catch (error) {
                        // Continue without video
                    }
                }

                cards.push({
                    title: anilistInfo ? anilistInfo.title.romaji : match.filename,
                    body: bodyText,
                    footer: "✨ Powered by trace.moe",
                    header: videoBuffer,
                    buttons: cardButtons
                });
            }

            const carousel = new TemplateBuilder.Carousel(Chisato);
            carousel
                .mainHeader("🔍 TRACE.MOE - ANIME SEARCH")
                .mainBody(`Found ${topResults.length} possible matches! Swipe to see all results.`)
                .mainFooter("✨ Powered by trace.moe & Anilist")
                .cards(cards);

            const msg = await carousel.render();
            await Chisato.relayMessage(from, msg.message, {
                messageId: msg.key.id
            });

        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            
            const errorMessage =
                error instanceof Error ? error.message : String(error);

            let text = `*「 TRACE.MOE ERROR 」*\n\n`;
            text += `❌ Failed to search anime:\n`;
            text += `${errorMessage}\n\n`;
            text += `💡 *Tips:*\n`;
            text += `• Use clear anime screenshots\n`;
            text += `• Avoid heavily edited images\n`;
            text += `• Try different scenes from the anime`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
