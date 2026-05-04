import type { ConfigCommands } from "../../types/structure/commands.js";
import yts from "yt-search";
import Axios from "axios";

export default {
    name: "youtubesearch",
    alias: ["ytsearch", "yts", "searchyt"],
    category: "search",
    usage: "[query]",
    description: "Search youtube video, channel, live, or playlist",
    limit: 1,
    cooldown: 5,
    example: `*「 YOUTUBE SEARCH 」*

🔍 Search for videos, channels, and playlists on YouTube!

📝 *How to use:*
{prefix}{command.name} [query]

💡 *Example:*
• {prefix}{command.name} xxxxx`,
    async run({ Chisato, query, from, message, command, prefix }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const res = await yts(query);
            const results = res.all.slice(0, 10);

            if (results.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, "No results found!", message);
            }

            const builder = new (Chisato as any).TemplateBuilder.Carousel(
                Chisato
            );

            const cards = await Promise.all(
                results.map(async (result, index) => {
                    let imageBuffer: Buffer | undefined;

                    try {
                        const response = await Axios.get(result.image, {
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

                    let caption = "";
                    let typeEmoji = "📺";
                    let buttons: any[] = [];

                    if (result.type === "channel") {
                        typeEmoji = "👤";
                        caption =
                            `• *Name:* ${result.name}\n` +
                            `• *Type:* Channel\n` +
                            `• *Subscribers:* ${result.subCountLabel}\n`;

                        buttons = [
                            builder.button.url({
                                display: "🔗 View Channel",
                                url: result.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: result.url,
                            }),
                        ];
                    } else if (result.type === "video") {
                        typeEmoji = "🎥";
                        caption =
                            `• *Channel:* ${result.author.name}\n` +
                            `• *Duration:* ${result.timestamp}\n` +
                            `• *Views:* ${result.views.toLocaleString()}\n` +
                            `• *Uploaded:* ${result.ago}\n`;

                        buttons = [
                            builder.button.url({
                                display: "▶️ Watch Video",
                                url: result.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: result.url,
                            }),
                        ];
                    } else if (result.type === "live") {
                        typeEmoji = "🔴";
                        caption =
                            `• *Channel:* ${result.author.name}\n` +
                            `• *Status:* ${result.status}\n` +
                            `• *Watching:* ${result.watching}\n`;

                        buttons = [
                            builder.button.url({
                                display: "🔴 Watch Live",
                                url: result.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: result.url,
                            }),
                        ];
                    } else if (result.type === "list") {
                        typeEmoji = "📋";
                        caption =
                            `• *Channel:* ${result.author.name}\n` +
                            `• *Video Count:* ${result.videoCount}\n`;

                        buttons = [
                            builder.button.url({
                                display: "📋 View Playlist",
                                url: result.url,
                            }),
                            builder.button.copy({
                                display: "📋 Copy URL",
                                code: result.url,
                            }),
                        ];
                    }

                    const titleText =
                        result.type === "channel"
                            ? (result as any).name || result.title
                            : result.title;

                    return {
                        body: caption,
                        footer: `Result ${index + 1} of ${results.length}`,
                        title: `*「 YOUTUBE ${result.type.toUpperCase()} 」*\n${typeEmoji} ${
                            titleText || "YouTube Result"
                        }`,
                        header: imageBuffer,
                        buttons,
                    };
                })
            );

            Chisato.logger.info(`Preparing carousel with ${cards.length} cards...`);

            const msg = await builder
                .mainHeader(`YouTube Search - ${query}`, undefined)
                .mainBody(
                    `Found ${results.length} results for "${query}"\n\n` +
                        `Swipe to see more results! 👉`
                )
                .mainFooter("Powered by YouTube")
                .cards(cards)
                .render();

            Chisato.logger.info("Carousel message generated, sending...");

            await Chisato.relayMessage(from, msg.message, {
                messageId: msg.key.id,
            });
            await Chisato.sendReaction(from, "✅", message.key);

            Chisato.logger.info("Carousel sent successfully!");
        } catch (err: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, err);
            Chisato.sendText(
                from,
                "There is an error. Please report it to the bot creator immediately!\nMessage: " +
                    err.message,
                message
            );
        }
    },
} satisfies ConfigCommands;