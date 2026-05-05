import type { ConfigCommands } from "../../types/structure/commands";
import { ThreadsScraper } from "../../utils/scrapers/downloader/threads.scraper";
import { Validators } from "../../utils/core";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

export default {
    name: "threads",
    alias: ["threadsdl", "threadsdown"],
    usage: "[url]",
    category: "downloader",
    description: "Download Video or Photo from Threads",
    cooldown: 5,
    limit: 2,
    example: `*「 THREADS DOWNLOADER 」*

📥 Download videos & photos from Threads!

📝 *How to use:*
{prefix}{command.name} [url]

💡 *Example:*
• {prefix}{command.name} https://www.threads.net/@username/post/xxxxx`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!query || !Validators.isURL(query)) {
            return;
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            const scraper = new ThreadsScraper();
            const result = await scraper.download(query);

            if (!result || result.items.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Cannot find media. Make sure the URL is valid and the post is public.",
                    message
                );
            }

            await Chisato.sendReaction(from, "✅", message.key);

            const videos = scraper.getVideos(result);
            const images = scraper.getImages(result);
            const hasVideo = videos.length > 0;
            const hasImages = images.length > 0;

            // ── Video post ────────────────────────────────────────────────────
            if (hasVideo) {
                let text = `*「 THREADS VIDEO DOWNLOADER 」*\n\n`;
                text += `🎥 *Found ${videos.length} video(s)*\n`;
                text += `\n✨ Powered by SnapSave`;

                const builder = new TemplateBuilder.Native(Chisato);
                builder.mainBody(text).mainFooter("Threads Video Downloader");

                const buttons = videos.slice(0, 3).map((v) =>
                    builder.button.url({ display: `📥 Download${v.quality ? ` (${v.quality})` : ""}`, url: v.url })
                );
                builder.buttons(...buttons);

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });

                const bestVideo = scraper.getBestMedia(result);
                if (bestVideo) {
                    try {
                        await Chisato.sendVideo(from, bestVideo.url, false, `*Threads Video*`, message);
                    } catch {
                        Chisato.logger.error(command.name, "Failed to send video");
                    }
                }
                return;
            }

            // ── Photo post (single or carousel) ──────────────────────────────
            if (hasImages) {
                if (images.length === 1) {
                    return Chisato.sendImage(
                        from,
                        images[0].url,
                        `*「 THREADS PHOTO 」*\n\n✨ Powered by SnapSave`,
                        message
                    );
                }

                // Carousel — send caption first, then each image
                let text = `*「 THREADS PHOTOS 」*\n\n📸 *${images.length} photos found*\n✨ Powered by SnapSave`;
                await Chisato.sendText(from, text, message);

                for (const img of images) {
                    try {
                        await Chisato.sendImage(from, img.url, "", message);
                    } catch {
                        Chisato.logger.error(command.name, "Failed to send image");
                    }
                }
                return;
            }
        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);

            const errorMessage = error instanceof Error ? error.message : String(error);
            Chisato.logger.error(command.name, errorMessage);

            const isPrivate = /private|restricted/i.test(errorMessage);

            if (isPrivate) {
                return Chisato.sendText(
                    from,
                    `*「 THREADS DOWNLOADER 」*\n\n❌ *Post is private or restricted.*\n\nOnly public Threads posts can be downloaded.`,
                    message
                );
            }

            let text = `*「 THREADS DOWNLOADER ERROR 」*\n\n`;
            text += `❌ Failed to download media:\n`;
            text += `${errorMessage}\n\n`;
            text += `💡 *Tips:*\n`;
            text += `• Make sure the URL is valid\n`;
            text += `• Make sure the post is public\n`;
            text += `• Try again in a moment`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
