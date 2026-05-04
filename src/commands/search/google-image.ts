import type { ConfigCommands } from "../../types/structure/commands";
import { GoogleImagesScraper } from "../../utils/scrapers/search";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

// Store search results for pagination
const searchCache = new Map<string, { results: any[], timestamp: number }>();

export default {
    name: "googleimage",
    alias: ["gimage", "gimg", "googleimg"],
    usage: "[query] [page]",
    category: "search",
    description: "Search images on Google",
    cooldown: 5,
    limit: 2,
    example: `*「 GOOGLE IMAGE SEARCH 」*

🔍 Search for images on Google!

📝 *How to use:*
{prefix}{command.name} [query] [page]

💡 *Example:*
• {prefix}{command.name} cat
• {prefix}{command.alias} beautiful sunset
• {prefix}gimg anime wallpaper 2`,
    async run({ Chisato, from, query, prefix, message, command }) {
        const args = query?.trim().split(/\s+/) || [];
        const pageNum = args.length > 1 && !isNaN(parseInt(args[args.length - 1])) 
            ? parseInt(args.pop()!) 
            : 1;
        const searchQuery = args.join(" ");

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            
            const cacheKey = `${from}:${searchQuery}`;
            let results: any[];
            const cached = searchCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < 300000) {
                results = cached.results;
            } else {
                const scraper = new GoogleImagesScraper();
                results = await scraper.search(searchQuery);
                
                searchCache.set(cacheKey, { results, timestamp: Date.now() });
                
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
                let text = `*「 GOOGLE IMAGE SEARCH 」*\n\n`;
                text += `🔍 *Query:* ${searchQuery}\n`;
                text += `📊 *Dimensions:* ${image.width}x${image.height}\n`;
                text += `\n✨ Powered by Google Images`;

                const builder = new TemplateBuilder.Native(Chisato);
                
                builder
                    .mainBody(text)
                    .mainFooter("Google Image Search");

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
                    const Axios = require("axios");
                    const response = await Axios.get(image.url, {
                        responseType: "arraybuffer",
                        timeout: 15000,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                            "Referer": "https://www.google.com/",
                        },
                    });
                    const imageBuffer = Buffer.from(response.data);
                    
                    await Chisato.sendImage(
                        from,
                        imageBuffer,
                        `*${searchQuery}*\n${image.width}x${image.height}`,
                        message
                    );
                } catch (error) {
                    Chisato.logger.error(command.name, "Failed to send image");
                    for (let i = 1; i < Math.min(results.length, 5); i++) {
                        try {
                            const Axios = require("axios");
                            const altImage = results[i];
                            const response = await Axios.get(altImage.url, {
                                responseType: "arraybuffer",
                                timeout: 15000,
                                headers: {
                                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                    "Referer": "https://www.google.com/",
                                },
                            });
                            const imageBuffer = Buffer.from(response.data);
                            
                            await Chisato.sendImage(
                                from,
                                imageBuffer,
                                `*${searchQuery}*\n${altImage.width}x${altImage.height}`,
                                message
                            );
                            break;
                        } catch (err) {
                            // Continue to next image
                        }
                    }
                }

            } else {
                const builder = new (Chisato as any).TemplateBuilder.Carousel(Chisato);
                const Axios = require("axios");
                
                const validCards = [];
                let imageIndex = 0;
                let resultIndex = startIndex;
                
                while (validCards.length < maxResults && resultIndex < endIndex) {
                    const image = results[resultIndex];
                    resultIndex++;
                    
                    try {
                        const response = await Axios.get(image.url, {
                            responseType: "arraybuffer",
                            timeout: 15000,
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                "Referer": "https://www.google.com/",
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

                        validCards.push({
                            body: `*Dimensions:* ${image.width}x${image.height}`,
                            footer: `Image ${imageIndex} | Page ${currentPage}/${totalPages}`,
                            title: "",
                            header: imageBuffer,
                            buttons: cardButtons,
                        });
                    } catch (err: any) {
                        console.error(
                            `Skipping image ${resultIndex} (${err?.response?.status || err?.message})`
                        );
                        // Continue to next image
                    }
                }

                if (validCards.length === 0) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Failed to download images. All images returned errors (403/404).\nTry a different search query.",
                        message
                    );
                }

                let navText = "";
                if (totalPages > 1) {
                    navText = `\n📄 *Page ${currentPage}/${totalPages}*\n`;
                    if (currentPage < totalPages) {
                        navText += `\n➡️ Next: ${prefix}${command.name} ${searchQuery} ${currentPage + 1}`;
                    }
                    if (currentPage > 1) {
                        navText += `\n⬅️ Prev: ${prefix}${command.name} ${searchQuery} ${currentPage - 1}`;
                    }
                }

                const msg = await builder
                    .mainHeader("*「 GOOGLE IMAGE SEARCH 」*", false)
                    .mainBody(
                        `*「 GOOGLE IMAGE SEARCH 」*\n\n` +
                        `🔍 *Query:* ${searchQuery}\n` +
                        `📊 *Showing:* ${validCards.length} images\n` +
                        `🌐 *Total Found:* ${results.length}` +
                        navText +
                        `\n\n✨ Powered by Google Images\n\n` +
                        `Swipe to see all images! 👉`
                    )
                    .mainFooter("Google Image Search")
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

                    navBuilder.mainBody(navButtonText).mainFooter("Use buttons to navigate");

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
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            Chisato.logger.error(command.name, errorMessage);

            let text = `*「 GOOGLE IMAGE SEARCH ERROR 」*\n\n`;
            text += `❌ Failed to search images:\n`;
            text += `${errorMessage}\n\n`;
            text += `💡 *Tips:*\n`;
            text += `• Try different keywords\n`;
            text += `• Check your internet connection\n`;
            text += `• Try again in a moment`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;