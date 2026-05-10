import type { ConfigCommands } from "../../types/structure/commands";
import { PexelsScraper } from "../../utils/scrapers/search";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import axios from "axios";

const searchCache = new Map<string, { results: any[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export default {
    name: "pexels",
    alias: ["pexelsimage", "pexelsimg"],
    usage: "[query] [page]",
    category: "search",
    description: "Search images on Pexels",
    cooldown: 5,
    limit: 2,
    example: `*「 PEXELS IMAGE SEARCH 」*

📷 Search for high-quality images on Pexels!

📝 *How to use:*
{prefix}{command.name} [query] [page]

💡 *Example:*
• {prefix}{command.name} cat
• {prefix}{command.name} beautiful sunset 2`,
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

            const cacheKey = `pexels:${searchQuery}`;
            let results: any[];
            const cached = searchCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                results = cached.results;
            } else {
                const scraper = new PexelsScraper();
                results = await scraper.search(searchQuery);
                searchCache.set(cacheKey, { results, timestamp: Date.now() });

                for (const [key, value] of searchCache.entries()) {
                    if (Date.now() - value.timestamp > CACHE_TTL) searchCache.delete(key);
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
            const maxResults = endIndex - startIndex;

            await Chisato.sendReaction(from, "✅", message.key);

            if (maxResults === 1 && totalPages === 1) {
                const image = results[0];
                let text = `*「 PEXELS IMAGE SEARCH 」*\n\n`;
                text += `🔍 *Query:* ${searchQuery}\n`;
                if (image.title) text += `📌 *Title:* ${image.title}\n`;
                if (image.width && image.height) text += `📊 *Dimensions:* ${image.width}x${image.height}\n`;
                text += `\n✨ Powered by Pexels`;

                const builder = new TemplateBuilder.Native(Chisato);
                builder.mainBody(text).mainFooter("Pexels Image Search");
                builder.buttons(
                    builder.button.url({ display: "🔗 Open Image", url: image.url }),
                    builder.button.url({ display: "📄 Source", url: image.source })
                );

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

                try {
                    const res = await axios.get(image.url, { responseType: "arraybuffer", timeout: 15000 });
                    await Chisato.sendImage(from, Buffer.from(res.data), `*${searchQuery}*`, message);
                } catch {
                    Chisato.logger.error(command.name, "Failed to send image");
                }
            } else {
                const builder = new (Chisato as any).TemplateBuilder.Carousel(Chisato);
                const validCards = [];
                let imageIndex = 0;
                let resultIndex = startIndex;

                while (validCards.length < maxResults && resultIndex < endIndex) {
                    const image = results[resultIndex++];
                    try {
                        const res = await axios.get(image.url, { responseType: "arraybuffer", timeout: 15000 });
                        imageIndex++;
                        validCards.push({
                            header: Buffer.from(res.data),
                            title: "",
                            body: image.title ? `*${image.title.slice(0, 60)}*` : `Image ${imageIndex}`,
                            footer: `Image ${imageIndex} | Page ${currentPage}/${totalPages}`,
                            buttons: [
                                builder.button.url({ display: "🔗 Open Image", url: image.url }),
                                builder.button.url({ display: "📄 Source", url: image.source }),
                            ],
                        });
                    } catch (err: any) {
                        console.error(`Skipping image ${resultIndex} (${err?.response?.status || err?.message})`);
                    }
                }

                if (validCards.length === 0) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(from, "❌ Failed to download images. Try a different search query.", message);
                }

                let navText = "";
                if (totalPages > 1) {
                    navText = `\n📄 *Page ${currentPage}/${totalPages}*`;
                    if (currentPage < totalPages) navText += `\n➡️ Next: ${prefix}${command.name} ${searchQuery} ${currentPage + 1}`;
                    if (currentPage > 1) navText += `\n⬅️ Prev: ${prefix}${command.name} ${searchQuery} ${currentPage - 1}`;
                }

                const msg = await builder
                    .mainHeader("*「 PEXELS IMAGE SEARCH 」*", false)
                    .mainBody(
                        `*「 PEXELS IMAGE SEARCH 」*\n\n` +
                        `🔍 *Query:* ${searchQuery}\n` +
                        `📊 *Showing:* ${validCards.length} images\n` +
                        `🌐 *Total Found:* ${results.length}` +
                        navText +
                        `\n\n✨ Powered by Pexels\n\nSwipe to see all images! 👉`
                    )
                    .mainFooter("Pexels Image Search")
                    .cards(validCards)
                    .render();

                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

                if (totalPages > 1) {
                    const navBuilder = new TemplateBuilder.Native(Chisato);
                    navBuilder
                        .mainBody(`*「 NAVIGATION 」*\n\n📄 Page ${currentPage} of ${totalPages}\n🌐 Total: ${results.length} images`)
                        .mainFooter("Use buttons to navigate");

                    const navButtons = [];
                    if (currentPage > 1) navButtons.push(navBuilder.button.reply({ display: "⬅️ Previous", id: `${prefix}${command.name} ${searchQuery} ${currentPage - 1}` }));
                    if (currentPage < totalPages) navButtons.push(navBuilder.button.reply({ display: "➡️ Next", id: `${prefix}${command.name} ${searchQuery} ${currentPage + 1}` }));

                    if (navButtons.length > 0) {
                        navBuilder.buttons(...navButtons);
                        const navMsg = await navBuilder.render();
                        await Chisato.relayMessage(from, navMsg.message, { messageId: navMsg.key.id });
                    }
                }
            }
        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error);
            return Chisato.sendText(
                from,
                `❌ Failed to search images.\n\nError: ${error instanceof Error ? error.message : String(error)}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
