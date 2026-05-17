import type { ConfigCommands } from "../../types/structure/commands";
import { PixivScraper } from "../../utils/scrapers/search";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";
import axios from "axios";

const MAX_LIST_ITEMS = 10;
const MAX_CONTENT_LENGTH = 1500;
const MAX_CAROUSEL_ITEMS = 10;
const DEFAULT_PAGE = 1;

const buildListRows = (items: any[], prefix: string, commandName: string, type: string) =>
    items.slice(0, MAX_LIST_ITEMS).map((item, index) => ({
        title: item.title?.slice(0, 60) || `Result ${index + 1}`,
        description: `${item.userName || "Unknown"} · ID ${item.id}`,
        id:
            type === "novel"
                ? `${prefix}${commandName} novelcontent ${item.id}`
                : `${prefix}${commandName} download ${item.id}`,
    }));

const formatUrls = (urls: string[]) =>
    urls
        .filter(Boolean)
        .slice(0, 5)
        .map((url, index) => `• ${index + 1}. ${url}`)
        .join("\n");

export default {
    name: "pixiv",
    alias: ["pxv"],
    usage: "[art|manga|novel|novelcontent|download] [query|id]",
    category: "search",
    description: "Search Pixiv artworks, manga, or novels",
    cooldown: 5,
    limit: 2,
    interactiveSelection: true,
    example: `*「 PIXIV 」*

🔍 Search Pixiv content!

📝 *How to use:*
{prefix}{command.name} art [keyword]
{prefix}{command.name} manga [keyword]
{prefix}{command.name} novel [keyword]
{prefix}{command.name} novelcontent [novel-id]
{prefix}{command.name} download [illust-id]

💡 *Example:*
• {prefix}{command.name} art genshin
• {prefix}{command.name} download 123456789`,
    async run({ Chisato, from, query, message, prefix, command }) {
        const args = query?.trim().split(/\s+/).filter(Boolean) || [];
        const mode = args.shift()?.toLowerCase();

        if (!mode) {
            return Chisato.sendText(
                from,
                `*「 PIXIV 」*\n\n❌ Please provide a mode.\n\nUsage:\n${prefix}${command.name} art [keyword]\n${prefix}${command.name} manga [keyword]\n${prefix}${command.name} novel [keyword]\n${prefix}${command.name} novelcontent [novel-id]\n${prefix}${command.name} download [illust-id]`,
                message
            );
        }

        const scraper = new PixivScraper();

        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            if (mode === "art" || mode === "manga" || mode === "novel") {
                const lastArg = args[args.length - 1];
                const pageNum = lastArg && !Number.isNaN(Number(lastArg)) ? Number(args.pop()) : DEFAULT_PAGE;
                const keyword = args.join(" ");
                if (!keyword) {
                    return Chisato.sendText(
                        from,
                        `❌ Please provide a keyword.\n\nExample: ${prefix}${command.name} ${mode} chiisato`,
                        message
                    );
                }

                const results =
                    mode === "art"
                        ? await scraper.searchArtwork(keyword, pageNum)
                        : mode === "manga"
                        ? await scraper.searchManga(keyword, pageNum)
                        : await scraper.searchNovel(keyword, pageNum);

                if (!results.length) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(from, "❌ No results found.", message);
                }

                if (mode === "novel") {
                    const builder = new TemplateBuilder.Native(Chisato);
                    const rows = buildListRows(results, prefix, command.name, mode);

                    builder
                        .mainBody(`*「 PIXIV ${mode.toUpperCase()} 」*\n\n🔍 *Query:* ${keyword}\n📊 *Results:* ${results.length}\n\nPilih item untuk melihat detail:`)
                        .mainFooter("pixiv.net")
                        .buttons(
                            builder.button.list({
                                display: `📚 ${mode.toUpperCase()} Results`,
                                sections: [
                                    {
                                        title: `Top ${Math.min(results.length, MAX_LIST_ITEMS)} Results`,
                                        rows,
                                    },
                                ],
                            })
                        );

                    const msg = await builder.render();
                    await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
                    if (pageNum > 1 || results.length > 0) {
                        const navBuilder = new TemplateBuilder.Native(Chisato);
                        const navButtons = [];
                        if (pageNum > 1) {
                            navButtons.push(
                                navBuilder.button.reply({
                                    display: "⬅️ Previous Page",
                                    id: `${prefix}${command.name} novel ${keyword} ${pageNum - 1}`,
                                })
                            );
                        }
                        if (results.length > 0) {
                            navButtons.push(
                                navBuilder.button.reply({
                                    display: "➡️ Next Page",
                                    id: `${prefix}${command.name} novel ${keyword} ${pageNum + 1}`,
                                })
                            );
                        }
                        if (navButtons.length > 0) {
                            const navMsg = await navBuilder
                                .mainBody(`📄 Page ${pageNum}`)
                                .mainFooter("Use buttons to navigate")
                                .buttons(...navButtons)
                                .render();
                            await Chisato.relayMessage(from, navMsg.message, { messageId: navMsg.key.id });
                        }
                    }
                    await Chisato.sendReaction(from, "✅", message.key);
                    return;
                }

                const builder = new TemplateBuilder.Carousel(Chisato);
                const cards: any[] = [];
                const maxItems = Math.min(results.length, MAX_CAROUSEL_ITEMS);

                for (let i = 0; i < maxItems; i += 1) {
                    const item = results[i];
                    const pixivUrl = `https://www.pixiv.net/en/artworks/${item.id}`;

                    try {
                        const download = await scraper.downloadArtworks(item.id);
                        const imageUrl = download.url.original[0] || download.url.sd[0];
                        if (!imageUrl) {
                            continue;
                        }

                        const res = await axios.get(imageUrl, {
                            responseType: "arraybuffer",
                            timeout: 15000,
                            headers: {
                                Referer: "https://www.pixiv.net/",
                                "User-Agent":
                                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                            },
                        });

                        cards.push({
                            header: Buffer.from(res.data),
                            title: item.title?.slice(0, 60) || `Result ${i + 1}`,
                            body: `👤 ${item.userName} (ID ${item.userId})\n🆔 ${item.id}`,
                            footer: `Result ${i + 1} of ${maxItems}`,
                            buttons: [
                                builder.button.url({ display: "🔗 Open Pixiv", url: pixivUrl }),
                                builder.button.copy({ display: "📋 Copy URL", code: imageUrl }),
                            ],
                        });
                    } catch {
                        // Skip failed image
                    }
                }

                if (!cards.length) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Failed to load images. Try again later.",
                        message
                    );
                }

                const msg = await builder
                    .mainHeader(`*「 PIXIV ${mode.toUpperCase()} 」*`)
                    .mainBody(
                        `🔍 *Query:* ${keyword}\n` +
                        `📊 *Showing:* ${cards.length} items\n` +
                        `📄 *Page:* ${pageNum}\n` +
                        `Swipe to see more results! 👉`
                    )
                    .mainFooter("pixiv.net")
                    .cards(cards)
                    .render();

                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
                if (pageNum > 1 || results.length > 0) {
                    const navBuilder = new TemplateBuilder.Native(Chisato);
                    const navButtons = [];
                    if (pageNum > 1) {
                        navButtons.push(
                            navBuilder.button.reply({
                                display: "⬅️ Previous Page",
                                id: `${prefix}${command.name} ${mode} ${keyword} ${pageNum - 1}`,
                            })
                        );
                    }
                    if (results.length > 0) {
                        navButtons.push(
                            navBuilder.button.reply({
                                display: "➡️ Next Page",
                                id: `${prefix}${command.name} ${mode} ${keyword} ${pageNum + 1}`,
                            })
                        );
                    }
                    if (navButtons.length > 0) {
                        const navMsg = await navBuilder
                            .mainBody(`📄 Page ${pageNum}`)
                            .mainFooter("Use buttons to navigate")
                            .buttons(...navButtons)
                            .render();
                        await Chisato.relayMessage(from, navMsg.message, { messageId: navMsg.key.id });
                    }
                }
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            if (mode === "novelcontent") {
                const id = args[0];
                if (!id) {
                    return Chisato.sendText(
                        from,
                        `❌ Please provide a novel ID.\n\nExample: ${prefix}${command.name} novelcontent 123456`,
                        message
                    );
                }

                const data = await scraper.getNovelContent(id);
                const content = data.content.length > MAX_CONTENT_LENGTH
                    ? `${data.content.slice(0, MAX_CONTENT_LENGTH)}...`
                    : data.content;

                const text =
                    `*「 PIXIV NOVEL 」*\n\n` +
                    `📖 *Title:* ${data.title}\n` +
                    `👤 *Author:* ${data.userName} (ID ${data.userId})\n` +
                    `👁️ *Views:* ${data.viewCount}  ❤️ *Likes:* ${data.likeCount}\n\n` +
                    `${content}`;

                await Chisato.sendText(from, text, message);
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            if (mode === "download") {
                const id = args[0];
                if (!id) {
                    return Chisato.sendText(
                        from,
                        `❌ Please provide an illustration ID.\n\nExample: ${prefix}${command.name} download 123456`,
                        message
                    );
                }

                const data = await scraper.downloadArtworks(id);
                const pixivUrl = `https://www.pixiv.net/en/artworks/${id}`;

                const text =
                    `*「 PIXIV DOWNLOAD 」*\n\n` +
                    `🖼️ *Title:* ${data.title}\n` +
                    `👤 *Author:* ${data.userName} (ID ${data.userId})\n` +
                    `📄 *Pages:* ${data.pageCount}\n` +
                    `🔗 *Pixiv:* ${pixivUrl}\n\n` +
                    `*Original URLs:*\n${formatUrls(data.url.original) || "No URLs"}`;

                const builder = new TemplateBuilder.Native(Chisato);
                builder
                    .mainBody(text)
                    .mainFooter("pixiv.net")
                    .buttons(
                        builder.button.url({ display: "🔗 Open Pixiv", url: pixivUrl }),
                        builder.button.copy({ display: "📋 Copy URL", code: data.url.original[0] || "" })
                    );

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            await Chisato.sendReaction(from, "❌", message.key);
            return Chisato.sendText(
                from,
                `❌ Unknown mode: ${mode}.\n\nUsage: ${prefix}${command.name} [art|manga|novel|novelcontent|download] ...`,
                message
            );
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(
                from,
                `❌ Failed to process Pixiv request.\n\nError: ${error?.message || "Unknown error"}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
