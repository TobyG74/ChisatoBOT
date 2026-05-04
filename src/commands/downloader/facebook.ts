import type { ConfigCommands } from "../../types/structure/commands";
import { FacebookScraper } from "../../utils/scrapers/downloader/facebook.scraper";
import { Validators } from "../../utils/core";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

export default {
    name: "facebook",
    alias: ["fb", "fbdl", "fbdownload"],
    usage: "[url]",
    category: "downloader",
    description: "Download Video from Facebook",
    cooldown: 5,
    limit: 2,
    example: `*「 FACEBOOK DOWNLOADER 」*

📥 Download videos from Facebook!

📝 *How to use:*
{prefix}{command.name} [url]

💡 *Example:*
• {prefix}{command.name} https://www.facebook.com/share/v/xxxxx/
• {prefix}{command.alias} https://fb.watch/xxxxx/`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!query || !Validators.isURL(query)) {
            return;
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            
            const scraper = new FacebookScraper();
            const result = await scraper.download(query);

            if (!result || result.videos.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Cannot find video. Make sure the URL is valid and the video is public.",
                    message
                );
            }

            await Chisato.sendReaction(from, "✅", message.key);

            let text = `*「 FACEBOOK VIDEO DOWNLOADER 」*\n\n`;
            text += `🎥 *Available Qualities:*\n`;
            result.videos.forEach((video, index) => {
                text += `${index + 1}. ${video.quality}\n`;
            });

            text += `\n✨ Powered by SnapSave`;

            const bestVideo = scraper.getBestQuality(result);

            const builder = new TemplateBuilder.Native(Chisato);
            
            builder
                .mainBody(text)
                .mainFooter("Facebook Video Downloader");

            const buttons = [];

            result.videos.slice(0, 3).forEach((video) => {
                buttons.push(
                    builder.button.url({
                        display: `📥 ${video.quality}`,
                        url: video.url,
                    })
                );
            });

            builder.buttons(...buttons);

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, {
                messageId: msg.key.id,
            });

            if (bestVideo) {
                try {
                    await Chisato.sendVideo(
                        from,
                        bestVideo.url,
                        false,
                        `*${bestVideo.quality}*`,
                        message
                    );
                } catch (error) {
                    Chisato.logger.error(command.name, "Failed to send video");
                }
            }

        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);

            const errorMessage = error instanceof Error ? error.message : String(error);
            Chisato.logger.error(command.name, errorMessage);

            const isPrivate = /private/i.test(errorMessage);

            if (isPrivate) {
                return Chisato.sendText(
                    from,
                    `*「 FACEBOOK DOWNLOADER 」*\n\n❌ *Video is private or restricted.*\n\nOnly public Facebook videos can be downloaded.`,
                    message
                );
            }

            let text = `*「 FACEBOOK DOWNLOADER ERROR 」*\n\n`;
            text += `❌ Failed to download video:\n`;
            text += `${errorMessage}\n\n`;
            text += `💡 *Tips:*\n`;
            text += `• Make sure the URL is valid\n`;
            text += `• Make sure the video is public\n`;
            text += `• Try again in a moment`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;