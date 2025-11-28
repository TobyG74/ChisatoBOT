import type { ConfigCommands } from "../../types/structure/commands.js";
import { wallpaper } from "../../utils";
import Axios from "axios";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

// Store search results for pagination
const searchCache = new Map<string, { results: any[], timestamp: number, totalResults: number }>();

export default {
    name: "zerochan",
    alias: ["zchan"],
    usage: "<latest|search|page> [query] [page]",
    category: "wallpaper",
    description: "Get latest or search wallpapers from ZeroChan with pagination",
    cooldown: 2,
    example: `• /zerochan latest\n• /zerochan latest 2\n• /zerochan search Chisato Nishikigi\n• /zerochan search Chisato Nishikigi 2`,
    async run({ Chisato, arg, from, message, prefix, command }) {
        try {
            const args = arg?.trim().split(/\s+/);
            const option = args?.[0]?.toLowerCase();

            let res: any[] = [];
            let queryText = "";
            let page = 1;
            let isLatest = false;
            let searchQuery = "";
            let nextUrl: string | undefined;
            let totalResults = 0;

            if (option === "latest") {
                const pageArg = args?.[1];
                if (pageArg && !isNaN(parseInt(pageArg))) {
                    page = parseInt(pageArg);
                }
                
                const cacheKey = `${from}:latest:${page}`;
                const cached = searchCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp) < 300000) {
                    res = cached.results;
                    totalResults = cached.totalResults;
                } else {
                    const latestResult = await wallpaper.ZeroChanLatest(page);
                    res = latestResult.results;
                    totalResults = res.length;
                    
                    searchCache.set(cacheKey, { results: res, totalResults, timestamp: Date.now() });
                    
                    for (const [key, value] of searchCache.entries()) {
                        if (Date.now() - value.timestamp > 300000) {
                            searchCache.delete(key);
                        }
                    }
                }
                
                queryText = "Latest";
                isLatest = true;
            } else if (option === "search") {
                const queryArgs = args?.slice(1);
                const lastArg = queryArgs?.[queryArgs.length - 1];
                
                if (lastArg && !isNaN(parseInt(lastArg))) {
                    page = parseInt(lastArg);
                    searchQuery = queryArgs.slice(0, -1).join(" ");
                } else {
                    searchQuery = queryArgs?.join(" ") || "";
                }
                
                if (!searchQuery) {
                    return Chisato.sendText(
                        from,
                        "Please provide a search query!\n\nExample:\n• /zerochan search Chisato Nishikigi\n• /zerochan search Chisato Nishikigi 2",
                        message
                    );
                }
                
                const cacheKey = `${from}:search:${searchQuery}:${page}`;
                const cached = searchCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp) < 300000) {
                    res = cached.results;
                    totalResults = cached.totalResults;
                } else {
                    const result = await wallpaper.ZeroChan(searchQuery, page);
                    res = result.results;
                    totalResults = res.length;
                    
                    searchCache.set(cacheKey, { results: res, totalResults, timestamp: Date.now() });
                    
                    for (const [key, value] of searchCache.entries()) {
                        if (Date.now() - value.timestamp > 300000) {
                            searchCache.delete(key);
                        }
                    }
                }
                
                queryText = searchQuery;
                isLatest = false;
            } else {
                if (!arg) {
                    return Chisato.sendText(
                        from,
                        "Usage:\n• /zerochan latest [page] - Get latest wallpapers\n• /zerochan search <query> [page] - Search wallpapers\n\nExample:\n• /zerochan latest\n• /zerochan latest 2\n• /zerochan search Chisato Nishikigi\n• /zerochan search Chisato Nishikigi 2",
                        message
                    );
                }
                
                searchQuery = arg;
                
                const cacheKey = `${from}:search:${searchQuery}:1`;
                const cached = searchCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp) < 300000) {
                    res = cached.results;
                    totalResults = cached.totalResults;
                } else {
                    const result = await wallpaper.ZeroChan(arg, 1);
                    res = result.results;
                    totalResults = res.length;
                    
                    searchCache.set(cacheKey, { results: res, totalResults, timestamp: Date.now() });
                    
                    for (const [key, value] of searchCache.entries()) {
                        if (Date.now() - value.timestamp > 300000) {
                            searchCache.delete(key);
                        }
                    }
                }
                
                queryText = arg;
                isLatest = false;
            }

            if (res.length === 0) {
                return Chisato.sendText(from, "Not found!", message);
            }

            const results = res
                .slice(0, 10)
                .filter((item) => item && item.url && item.tag);

            if (results.length === 0) {
                return Chisato.sendText(
                    from,
                    "No valid results found!",
                    message
                );
            }

            const builder = new TemplateBuilder.Carousel(Chisato);

            const cards = await Promise.all(
                results.map(async (item, index) => {
                    let imageBuffer: Buffer | undefined;

                    try {
                        const imageUrl = item.imagePreview;
                        const response = await Axios.get(imageUrl, {
                            responseType: "arraybuffer",
                            timeout: 10000,
                        });
                        imageBuffer = Buffer.from(response.data);
                    } catch (err: any) {
                        console.error(
                            `Failed to download image ${index + 1}:`,
                            err?.message
                        );
                        imageBuffer = undefined;
                    }

                    const caption =
                        `• *Dimensions:* ${item.width || "N/A"}×${
                            item.height || "N/A"
                        }\n` +
                        `• *Ratio:* ${item.ratio || "N/A"}\n` +
                        `• *Size:* ${item.size || "N/A"}\n` +
                        `• *Format:* ${item.format?.toUpperCase() || "N/A"}\n` +
                        `• *Uploader:* ${item.uploader || "Unknown"}\n` +
                        `• *Tag:* ${item.tag || queryText}`;

                    return {
                        body: caption,
                        footer: `Image ${index + 1} of ${results.length}`,
                        title: item.tag || queryText,
                        header: imageBuffer,
                        buttons: [
                            builder.button.url({
                                display: "🔗 View Source",
                                url: item.source,
                            }),
                            builder.button.url({
                                display: "🖼️ Full Image",
                                url: item.imageFull || item.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: item.imageFull || item.url,
                            }),
                        ],
                    };
                })
            );

            console.log(`Preparing carousel with ${cards.length} cards...`);

            let paginationText = "";
            if (page > 1 || res.length >= 10) {
                paginationText = `\n\n📄 *Page ${page}*`;
                if (page > 1) {
                    paginationText += `\n⬅️ Prev: ${prefix}${command.name} ${isLatest ? 'latest' : 'search ' + searchQuery} ${page - 1}`;
                }
                if (res.length >= 10) {
                    paginationText += `\n➡️ Next: ${prefix}${command.name} ${isLatest ? 'latest' : 'search ' + searchQuery} ${page + 1}`;
                }
            }

            const msg = await builder
                .mainHeader(`ZeroChan - ${queryText}`, undefined)
                .mainBody(
                    `Found ${res.length} wallpapers for "${queryText}"\n` +
                    `📄 Page: ${page}${paginationText}\n\n` +
                    `Swipe to see more results! 👉`
                )
                .mainFooter("Powered by ZeroChan")
                .cards(cards)
                .render();

            console.log("Carousel message generated, sending...");

            await Chisato.relayMessage(from, msg.message, {
                messageId: msg.key.id,
            });
            
            if (page > 1 || res.length >= 10) {
                const nativeBuilder = new TemplateBuilder.Native(Chisato);
                const buttons = [];
                
                if (page > 1) {
                    const prevPage = page - 1;
                    const prevCmd = isLatest 
                        ? `${prefix}${command.name} latest ${prevPage}`
                        : `${prefix}${command.name} search ${searchQuery || queryText} ${prevPage}`;
                    
                    buttons.push(
                        nativeBuilder.button.reply({
                            display: "⬅️ Previous Page",
                            id: prevCmd
                        })
                    );
                }
                
                if (res.length >= 10) {
                    const nextPage = page + 1;
                    const nextCmd = isLatest 
                        ? `${prefix}${command.name} latest ${nextPage}`
                        : `${prefix}${command.name} search ${searchQuery || queryText} ${nextPage}`;
                    
                    buttons.push(
                        nativeBuilder.button.reply({
                            display: "➡️ Next Page",
                            id: nextCmd
                        })
                    );
                }
                
                if (buttons.length > 0) {
                    const navMsg = await nativeBuilder
                        .mainBody(`📄 Current Page: ${page}\n🌐 Results: ${res.length} wallpapers`)
                        .mainFooter("Use buttons below to navigate")
                        .buttons(...buttons)
                        .render();
                    
                    await Chisato.relayMessage(from, navMsg.message, {
                        messageId: navMsg.key.id,
                    });
                }
            }

            console.log("Carousel sent successfully!");
        } catch (err: any) {
            if (err?.response?.status === 404) {
                return Chisato.sendText(from, "Not found!", message);
            }
            Chisato.sendText(
                from,
                "There is an error. Please report it to the bot creator immediately!\nMessage : " +
                    err.message,
                message
            );
            console.log(err);
        }
    },
} satisfies ConfigCommands;