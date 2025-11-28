import type { ConfigCommands } from "../../types/structure/commands";
import { InstagramScraper } from "../../utils/scrapers/downloader/instagram.scraper";
import { Validators } from "../../utils/core";
import { TemplateBuilder } from "../../libs/interactive/TemplateBuilder";

export default {
    name: "instagram",
    alias: ["ig", "igdl", "igdownload"],
    usage: "<url>",
    category: "downloader",
    description: "Download Image or Video from Instagram",
    cooldown: 5,
    limit: 2,
    example: `• /instagram https://www.instagram.com/p/xxxxx/\n• /ig https://www.instagram.com/reel/xxxxx/`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!query || !Validators.isURL(query)) {
            let text = `*「 INSTAGRAM DOWNLOADER 」*\n\n`;
            text += `📥 Download images or videos from Instagram!\n\n`;
            text += `📝 *How to use:*\n`;
            text += `${prefix}${command.name} [url]\n\n`;
            text += `💡 *Example:*\n`;
            text += `• ${prefix}${command.name} https://www.instagram.com/p/xxxxx/\n`;
            text += `• ${prefix}ig https://www.instagram.com/reel/xxxxx/`;
            
            return Chisato.sendText(from, text, message);
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            
            const scraper = new InstagramScraper();
            const result = await scraper.download(query);

            if (result.type === "video") {
                if (!result.video || !result.video.url) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Cannot find video. Make sure the URL is valid and the post is public.",
                        message
                    );
                }

                await Chisato.sendReaction(from, "✅", message.key);

                let text = `*「 INSTAGRAM VIDEO DOWNLOADER 」*\n\n`;
                text += `🎥 *Type:* Video\n`;
                text += `\n✨ Powered by SnapVid`;

                const builder = new TemplateBuilder.Native(Chisato);
                
                builder
                    .mainBody(text)
                    .mainFooter("Instagram Video Downloader");

                builder.buttons(
                    builder.button.url({
                        display: "📥 Download Video",
                        url: result.video.url,
                    })
                );

                const msg = await builder.render();
                await Chisato.relayMessage(from, msg.message, {
                    messageId: msg.key.id,
                });

                try {
                    await Chisato.sendVideo(
                        from,
                        result.video.url,
                        false,
                        `*Instagram Video*`,
                        message
                    );
                } catch (error) {
                    Chisato.log("error", command.name, "Failed to send video");
                }

            } else if (result.type === "image") {
                if (!result.images || result.images.length === 0) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Cannot find images. Make sure the URL is valid and the post is public.",
                        message
                    );
                }

                await Chisato.sendReaction(from, "✅", message.key);

                if (result.images.length === 1) {
                    const imageItem = result.images[0];
                    const bestQuality = scraper.getBestImageQuality(imageItem);
                    
                    if (!bestQuality || !bestQuality.url) {
                        await Chisato.sendReaction(from, "❌", message.key);
                        return Chisato.sendText(
                            from,
                            "❌ Cannot find high quality image.",
                            message
                        );
                    }

                    let text = `*「 INSTAGRAM IMAGE DOWNLOADER 」*\n\n`;
                    text += `🖼️ *Type:* Image\n`;
                    text += `📊 *Quality:* ${bestQuality.quality}\n`;
                    text += `\n✨ Powered by SnapVid`;

                    const builder = new TemplateBuilder.Native(Chisato);
                    
                    builder
                        .mainBody(text)
                        .mainFooter("Instagram Image Downloader");

                    builder.buttons(
                        builder.button.url({
                            display: "📥 Download Image",
                            url: bestQuality.url,
                        })
                    );

                    const msg = await builder.render();
                    await Chisato.relayMessage(from, msg.message, {
                        messageId: msg.key.id,
                    });

                    try {
                        await Chisato.sendImage(
                            from,
                            bestQuality.url,
                            `*Instagram Image - ${bestQuality.quality}*`,
                            message
                        );
                    } catch (error) {
                        Chisato.log("error", command.name, "Failed to send image");
                    }

                } else {
                    const builder = new (Chisato as any).TemplateBuilder.Carousel(Chisato);

                    const Axios = require("axios");
                    const cards = await Promise.all(
                        result.images.map(async (imageItem, index) => {
                            const bestQuality = scraper.getBestImageQuality(imageItem);
                            let imageBuffer: Buffer | undefined;

                            if (bestQuality && bestQuality.url) {
                                try {
                                    const response = await Axios.get(bestQuality.url, {
                                        responseType: "arraybuffer",
                                        timeout: 15000,
                                    });
                                    imageBuffer = Buffer.from(response.data);
                                } catch (err: any) {
                                    console.error(
                                        `Failed to download image ${index + 1}:`,
                                        err?.message
                                    );
                                    imageBuffer = undefined;
                                }
                            }

                            return {
                                body: "",
                                footer: `Image ${index + 1} of ${result.images.length}`,
                                title: "",
                                header: imageBuffer,
                                buttons: [
                                    builder.button.url({
                                        display: "📥 Full Quality",
                                        url: bestQuality?.url || imageItem.defaultUrl,
                                    }),
                                    builder.button.copy({
                                        display: "📋 Copy URL",
                                        code: bestQuality?.url || imageItem.defaultUrl,
                                    }),
                                ],
                            };
                        })
                    );

                    const msg = await builder
                        .mainHeader("*「 INSTAGRAM IMAGES 」*", false)
                        .mainBody(
                            `*「 INSTAGRAM IMAGE DOWNLOADER 」*\n\n` +
                            `🖼️ *Type:* Image Carousel\n` +
                            `📊 *Total Images:* ${result.images.length}\n\n` +
                            `✨ Powered by SnapVid\n\n` +
                            `Swipe to see all images! 👉`
                        )
                        .mainFooter("Instagram Image Downloader")
                        .cards(cards)
                        .render();

                    await Chisato.relayMessage(from, msg.message, {
                        messageId: msg.key.id,
                    });
                }
            }

        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            
            const errorMessage = error instanceof Error ? error.message : String(error);
            Chisato.log("error", command.name, errorMessage);

            let text = `*「 INSTAGRAM DOWNLOADER ERROR 」*\n\n`;
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