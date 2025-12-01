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

            if (!result || result.mp4.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Cannot find video. Make sure the URL is valid and the video is public.",
                    message
                );
            }

            const directVideos = result.mp4.filter(v => v.type === "direct" && v.url);

            if (directVideos.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Video is not available for direct download. All videos require rendering.",
                    message
                );
            }

            await Chisato.sendReaction(from, "✅", message.key);

            let text = `*「 FACEBOOK VIDEO DOWNLOADER 」*\n\n`;
            text += `📌 *Title:* ${result.title}\n`;
            
            if (result.duration) {
                text += `⏱️ *Duration:* ${result.duration}\n`;
            }
            
            text += `\n🎥 *Available Qualities:*\n`;
            directVideos.forEach((video, index) => {
                text += `${index + 1}. ${video.quality}\n`;
            });

            text += `\n✨ Powered by SnapVid`;

            const bestVideo = directVideos.sort((a, b) => {
                const getQuality = (q: string) => {
                    if (q.includes("720")) return 2;
                    if (q.includes("360")) return 1;
                    return 0;
                };
                return getQuality(b.quality) - getQuality(a.quality);
            })[0];

            const builder = new TemplateBuilder.Native(Chisato);
            
            builder
                .mainBody(text)
                .mainFooter("Facebook Video Downloader");

            const buttons = [];

            directVideos.slice(0, 3).forEach((video) => {
                if (video.url) {
                    buttons.push(
                        builder.button.url({
                            display: `📥 ${video.quality}`,
                            url: video.url,
                        })
                    );
                }
            });

            builder.buttons(...buttons);

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, {
                messageId: msg.key.id,
            });

            if (bestVideo && bestVideo.url) {
                try {
                    await Chisato.sendVideo(
                        from,
                        bestVideo.url,
                        false,
                        `*${bestVideo.quality}*`,
                        message
                    );
                } catch (error) {
                    Chisato.log("error", command.name, "Failed to send video");
                }
            }

        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            Chisato.log("error", command.name, errorMessage);

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