import type { ConfigCommands } from "../../types/structure/commands";
import { DuckDuckGoImagesScraper } from "../../utils/scrapers/search";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import axios from "axios";

// Store search results for pagination (5-minute TTL)
const searchCache = new Map<string, { results: any[]; timestamp: number }>();

export default {
    name: "ddgimage",
    alias: ["ddgimg", "duckimage", "duckimg"],
    usage: "[query] [page]",
    category: "search",
    description: "Search images on DuckDuckGo",
    cooldown: 5,
    limit: 2,
    example: `*「 DUCKDUCKGO IMAGE SEARCH 」*

🦆 Search for images on DuckDuckGo!

📝 *How to use:*
{prefix}{command.name} [query] [page]

💡 *Example:*
• {prefix}{command.name} cat
• {prefix}{command.alias} beautiful sunset
• {prefix}ddgimg anime wallpaper 2`,
    async run({ Chisato, from, query, prefix, message, command }) {
        const args = query?.trim().split(/\s+/) || [];
        const pageNum =
            args.length > 1 && !isNaN(parseInt(args[args.length - 1]))
                ? parseInt(args.pop()!)
                : 1;
        const searchQuery = args.join(" ");

        if (!searchQuery) {
            return Chisato.sendText(
                from,
                `❌ Please provide a search query.\n\nUsage: ${prefix}${command.name} [query]`,
                message
            );
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            const cacheKey = `ddg:${from}:${searchQuery}`;
            let results: any[];
            const cached = searchCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < 300000) {
                results = cached.results;
            } else {
                const scraper = new DuckDuckGoImagesScraper();
                results = await scraper.search(searchQuery);

                searchCache.set(cacheKey, { results, timestamp: Date.now() });

                // Evict stale cache entries
                for (const [key, value] of searchCache.entries()) {
                    if (Date.now() - value.timestamp > 300000) {
                        searchCache.delete(key);
                    }
                }
            }

            if (!results || results.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ No images found for your search query. Try different keywords.",
                    message
                );
            }

            const imagesPerPage = 10;
            const totalPages = Math.ceil(results.length / imagesPerPage);
            const currentPage = Math.min(Math.max(1, pageNum), totalPages);
            const startIndex = (currentPage - 1) * imagesPerPage;
            const endIndex = Math.min(startIndex + imagesPerPage, results.length);

            await Chisato.sendReaction(from, "✅", message.key);

            const maxResults = endIndex - startIndex;

            if (maxResults === 1 && totalPages === 1) {
                const image = results[0];
                let text = `*「 DUCKDUCKGO IMAGE SEARCH 」*\n\n`;
                text += `🔍 *Query:* ${searchQuery}\n`;
                if (image.title) text += `📌 *Title:* ${image.title}\n`;
                if (image.width && image.height)
                    text += `📊 *Dimensions:* ${image.width}x${image.height}\n`;
                text += `\n✨ Powered by DuckDuckGo`;

                const builder = new TemplateBuilder.Native(Chisato);
                builder
                    .mainBody(text)
                    .mainFooter("DuckDuckGo Image Search");

                builder.buttons(
                    builder.button.url({
                        display: "🔗 Open Image",
                        url: image.url,
                    })
                );

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, {
                    messageId: msg.key.id,
                });

                try {
                    const response = await axios.get(image.url, {
                        responseType: "arraybuffer",
                        timeout: 15000,
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                            "Referer": "https://duckduckgo.com/",
                        },
                    });
                    const imageBuffer = Buffer.from(response.data);
                    await Chisato.sendImage(from, imageBuffer, `*${searchQuery}*`, message);
                } catch (error) {
                    Chisato.logger.error(command.name, "Failed to send image");
                    for (let i = 1; i < Math.min(results.length, 5); i++) {
                        try {
                            const altImage = results[i];
                            const response = await axios.get(altImage.url, {
                                responseType: "arraybuffer",
                                timeout: 15000,
                                headers: {
                                    "User-Agent":
                                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                                    "Referer": "https://duckduckgo.com/",
                                },
                            });
                            const imageBuffer = Buffer.from(response.data);
                            await Chisato.sendImage(
                                from,
                                imageBuffer,
                                `*${searchQuery}*`,
                                message
                            );
                            break;
                        } catch (err) {
                            // Try next fallback
                        }
                    }
                }
            } else {
                const builder = new (Chisato as any).TemplateBuilder.Carousel(Chisato);

                const validCards = [];
                let imageIndex = 0;
                let resultIndex = startIndex;

                while (validCards.length < maxResults && resultIndex < endIndex) {
                    const image = results[resultIndex];
                    resultIndex++;

                    try {
                        const response = await axios.get(image.url, {
                            responseType: "arraybuffer",
                            timeout: 15000,
                            headers: {
                                "User-Agent":
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                                "Referer": "https://duckduckgo.com/",
                            },
                        });

                        const imageBuffer = Buffer.from(response.data);
                        imageIndex++;

                        const cardButtons = [
                            builder.button.url({
                                display: "🔗 Open Image",
                                url: image.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: image.url,
                            }),
                        ];

                        let cardBody = image.title
                            ? `*${image.title.slice(0, 60)}*`
                            : `Image ${imageIndex}`;
                        if (image.width && image.height)
                            cardBody += `\n${image.width}x${image.height}`;

                        validCards.push({
                            body: cardBody,
                            footer: `Image ${imageIndex} | Page ${currentPage}/${totalPages}`,
                            title: "",
                            header: imageBuffer,
                            buttons: cardButtons,
                        });
                    } catch (err: any) {
                      if (err.response?.status === 403 || err.response?.status === 404) {
                            Chisato.logger.info(
                                `Image ${resultIndex} returned ${err.response.status}, skipping.`
                            );
                        } else {
                            Chisato.logger.error(
                                `Failed to download image ${resultIndex}:`,
                                err instanceof Error ? err.message : String(err)
                            );
                        }
                    }
                }

                if (validCards.length === 0) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Failed to download images. All images returned errors.\nTry a different search query.",
                        message
                    );
                }

                let navText = "";
                if (totalPages > 1) {
                    navText = `\n📄 *Page ${currentPage}/${totalPages}*\n`;
                    if (currentPage < totalPages)
                        navText += `\n➡️ Next: ${prefix}${command.name} ${searchQuery} ${currentPage + 1}`;
                    if (currentPage > 1)
                        navText += `\n⬅️ Prev: ${prefix}${command.name} ${searchQuery} ${currentPage - 1}`;
                }

                const msg = await builder
                    .mainHeader("*「 DUCKDUCKGO IMAGE SEARCH 」*", false)
                    .mainBody(
                        `*「 DUCKDUCKGO IMAGE SEARCH 」*\n\n` +
                        `🔍 *Query:* ${searchQuery}\n` +
                        `📊 *Showing:* ${validCards.length} images\n` +
                        `🌐 *Total Found:* ${results.length}` +
                        navText +
                        `\n\n✨ Powered by DuckDuckGo\n\n` +
                        `Swipe to see all images! 👉`
                    )
                    .mainFooter("DuckDuckGo Image Search")
                    .cards(validCards)
                    .render();

                await Chisato.relayMessage(from, msg.message, {
                    messageId: msg.key.id,
                });

                if (totalPages > 1) {
                    const navBuilder = new TemplateBuilder.Native(Chisato);
                    let navButtonText = `*「 NAVIGATION 」*\n\n`;
                    navButtonText += `📄 Page ${currentPage} of ${totalPages}\n`;
                    navButtonText += `🌐 Total: ${results.length} images`;

                    navBuilder
                        .mainBody(navButtonText)
                        .mainFooter("Use buttons to navigate");

                    const navButtons = [];
                    if (currentPage > 1) {
                        navButtons.push(
                            navBuilder.button.reply({
                                display: "⬅️ Previous",
                                id: `${prefix}${command.name} ${searchQuery} ${currentPage - 1}`,
                            })
                        );
                    }
                    if (currentPage < totalPages) {
                        navButtons.push(
                            navBuilder.button.reply({
                                display: "➡️ Next",
                                id: `${prefix}${command.name} ${searchQuery} ${currentPage + 1}`,
                            })
                        );
                    }

                    if (navButtons.length > 0) {
                        navBuilder.buttons(...navButtons);
                        const navMsg = await navBuilder.render();
                        await Chisato.relayMessage(from, navMsg.message, {
                            messageId: navMsg.key.id,
                        });
                    }
                }
            }
        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error);
            return Chisato.sendText(
                from,
                `❌ An error occurred while searching for images.\n\nError: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                message
            );
        }
    },
} satisfies ConfigCommands;
