import type { ConfigCommands } from "../../types/structure/commands";
import { PinterestScraper } from "../../utils/scrapers/search";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import axios from "axios";

const PINTEREST_URL_REGEX = /https?:\/\/(?:[^/]+\.)?pinterest\./i;
const CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 30;

type SearchCacheEntry = {
    bookmarksByPage: Map<number, string>;
    timestamp: number;
    pageSize: number;
};

const searchCache = new Map<string, SearchCacheEntry>();

export default {
    name: "pinterest",
    alias: ["pin", "pinterestimg"],
    usage: "[query|url] [page]",
    category: "search",
    description: "Search images or download a Pinterest pin",
    cooldown: 5,
    limit: 2,
    example: `*「 PINTEREST SEARCH 」*

🔍 Search images or download a pin!

📝 *How to use:*
{prefix}{command.name} [query]
{prefix}{command.name} [url]
{prefix}{command.name} [query] [page]

💡 *Example:*
• {prefix}{command.name} anime
• {prefix}{command.name} https://www.pinterest.com/pin/1234567890/`,
    async run({ Chisato, from, query, prefix, message, command }) {
        const args = query?.trim().split(/\s+/).filter(Boolean) || [];
        if (!args.length) {
            return Chisato.sendText(
                from,
                `❌ Please provide a search query or Pinterest URL.\n\nUsage: ${prefix}${command.name} [query|url]`,
                message
            );
        }

        const pageArg = args[args.length - 1];
        const pageNum = pageArg && !Number.isNaN(Number(pageArg)) ? Number(args.pop()) : 1;
        const searchQuery = args.join(" ");
        const scraper = new PinterestScraper();

        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            if (PINTEREST_URL_REGEX.test(searchQuery)) {
                const data = await scraper.download(searchQuery);
                const text =
                    `*「 PINTEREST DOWNLOAD 」*\n\n` +
                    `👤 *Author:* ${data.authorFullname || data.authorUsername}\n` +
                    `📝 *Caption:* ${data.caption}\n` +
                    `🎞️ *Type:* ${data.type}\n` +
                    `🔗 *Source:* ${data.pinSource}`;

                const builder = new TemplateBuilder.Native(Chisato);
                builder
                    .mainBody(text)
                    .mainFooter("Pinterest")
                    .buttons(
                        builder.button.url({ display: "🔗 Open Pin", url: data.pinSource }),
                        builder.button.copy({ display: "📋 Copy Media", code: data.url })
                    );

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            const cacheKey = `${from}:${searchQuery.toLowerCase()}`;
            let cacheEntry = searchCache.get(cacheKey);
            if (!cacheEntry || Date.now() - cacheEntry.timestamp > CACHE_TTL || pageNum === 1) {
                cacheEntry = {
                    bookmarksByPage: new Map<number, string>(),
                    timestamp: Date.now(),
                    pageSize: DEFAULT_PAGE_SIZE,
                };
                searchCache.set(cacheKey, cacheEntry);
            }

            const bookmark = pageNum > 1 ? cacheEntry.bookmarksByPage.get(pageNum) : undefined;
            if (pageNum > 1 && !bookmark) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Page cache expired. Please start from page 1 again.",
                    message
                );
            }

            const response = await scraper.search(searchQuery, {
                bookmarks: bookmark ? [bookmark] : [],
                pageSize: cacheEntry.pageSize,
            });

            if (!response.results.length) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ No images found for your search query. Try different keywords.",
                    message
                );
            }

            const results = response.results.slice(0, 10);
            const builder = new TemplateBuilder.Carousel(Chisato);
            const cards = [] as any[];

            for (const [index, item] of results.entries()) {
                try {
                    const res = await axios.get(item.url, {
                        responseType: "arraybuffer",
                        timeout: 15000,
                    });
                    const imageBuffer = Buffer.from(res.data);

                    const caption =
                        `👤 *Author:* ${item.authorFullname || item.authorUsername}\n` +
                        `📝 *Caption:* ${item.caption}\n` +
                        `🎞️ *Type:* ${item.type}`;

                    cards.push({
                        header: imageBuffer,
                        title: item.caption?.slice(0, 60) || `Result ${index + 1}`,
                        body: caption,
                        footer: `Result ${index + 1} of ${results.length}`,
                        buttons: [
                            builder.button.url({ display: "🔗 Open Pin", url: item.pinSource }),
                            builder.button.copy({ display: "📋 Copy Media", code: item.url }),
                        ],
                    });
                } catch {
                    // Skip failed images
                }
            }

            if (!cards.length) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Failed to download images. Try a different search query.",
                    message
                );
            }

            const msg = await builder
                .mainHeader("*「 PINTEREST SEARCH 」*")
                .mainBody(
                    `🔍 *Query:* ${searchQuery}\n` +
                    `📊 *Showing:* ${cards.length} images\n` +
                    `📄 *Page:* ${pageNum}\n` +
                    `Swipe to see more results! 👉`
                )
                .mainFooter("Pinterest")
                .cards(cards)
                .render();

            await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

            const hasNext = Boolean(response.bookmarks?.length);
            if (hasNext) {
                cacheEntry.bookmarksByPage.set(pageNum + 1, response.bookmarks[0]);
                cacheEntry.timestamp = Date.now();
            }

            if (pageNum > 1 || hasNext) {
                const navBuilder = new TemplateBuilder.Native(Chisato);
                const buttons = [];

                if (pageNum > 1) {
                    buttons.push(
                        navBuilder.button.reply({
                            display: "⬅️ Previous Page",
                            id: `${prefix}${command.name} ${searchQuery} ${pageNum - 1}`,
                        })
                    );
                }

                if (hasNext) {
                    buttons.push(
                        navBuilder.button.reply({
                            display: "➡️ Next Page",
                            id: `${prefix}${command.name} ${searchQuery} ${pageNum + 1}`,
                        })
                    );
                }

                if (buttons.length > 0) {
                    const navMsg = await navBuilder
                        .mainBody("📄 Navigate results")
                        .mainFooter("Use buttons below")
                        .buttons(...buttons)
                        .render();

                    await Chisato.relayMessage(from, navMsg.message, { messageId: navMsg.key.id });
                }
            }

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error);
            return Chisato.sendText(
                from,
                `❌ Failed to process Pinterest request.\n\nError: ${error instanceof Error ? error.message : String(error)}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
