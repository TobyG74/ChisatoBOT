import type { ConfigCommands } from "../../types/structure/commands";
const Tiktok = require("@tobyg74/tiktok-api-dl");
import { Validators } from "../../utils/core";

export default {
    name: "tiktokimage",
    alias: ["tti", "tiktoki", "tiktokslide", "tiktoks"],
    usage: "<url|slide>",
    category: "downloader",
    description: "Download Images from Tiktok",
    cooldown: 3,
    limit: 1,
    example: `
Download One Image :
• /tiktokimage https://vt.tiktok.com/xxxxxxx|2
Download All Images :
• /tiktokimage https://vt.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, arg, prefix, command, message }) {
        const url = arg?.split("|")[0];
        const slide = arg?.split("|")[1];
        
        if (!url || !Validators.isURL(url)) {
            let text = `*「 TIKTOK IMAGE/SLIDE DOWNLOADER 」*\n\n`;
            text += `🖼️ Download gambar/slide dari TikTok!\n\n`;
            text += `📝 *Cara menggunakan:*\n`;
            text += `${prefix}${command.name} [url]\n`;
            text += `${prefix}${command.name} [url]|[nomor]\n\n`;
            text += `💡 *Contoh:*\n`;
            text += `Download semua gambar:\n`;
            text += `• ${prefix}${command.name} https://vt.tiktok.com/xxxxxxx\n\n`;
            text += `Download gambar tertentu (gambar ke-2):\n`;
            text += `• ${prefix}${command.name} https://vt.tiktok.com/xxxxxxx|2`;
            
            return Chisato.sendText(from, text, message);
        }
        Tiktok.Downloader(url, {
            version: "v1",
        })
            .then(async (res) => {
                if (res.status === "error") {
                    Chisato.log("error", command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }
                if (res.result.type === "video")
                    return Chisato.sendText(
                        from,
                        `The link / URL you entered was detected by Tiktok Video. To download it, you can use ${prefix}tiktokvideo`,
                        message
                    );
                if (Number(slide) > res.result.images.length)
                    return Chisato.sendText(
                        from,
                        `Sorry, Image to ${slide} is not available! Only ${res.result.images.length} images available!`,
                        message
                    );
                if (res.result.type === "image") {
                    if (slide) {
                        let str =
                            `*「 TIKTOK IMAGES 」*\n\n` +
                            `• Description: ${res.result.desc}\n` +
                            `• Total Images: ${res.result.images.length}\n` +
                            `• Author: ${res.result.author.nickname}\n` +
                            `• Likes: ${res.result.statistics.diggCount}\n` +
                            `• Comments: ${res.result.statistics.commentCount}\n`;

                        await Chisato.sendImage(
                            from,
                            res.result.images[Number(slide) - 1],
                            str,
                            message
                        );
                    } else if (res.result.images.length > 1) {
                        const builder = new (
                            Chisato as any
                        ).TemplateBuilder.Carousel(Chisato);

                        const Axios = require("axios");
                        const cards = await Promise.all(
                            res.result.images.map(
                                async (imageUrl: string, index: number) => {
                                    let imageBuffer: Buffer | undefined;

                                    try {
                                        const response = await Axios.get(
                                            imageUrl,
                                            {
                                                responseType: "arraybuffer",
                                                timeout: 15000,
                                            }
                                        );
                                        imageBuffer = Buffer.from(
                                            response.data
                                        );
                                    } catch (err: any) {
                                        console.error(
                                            `Failed to download image ${
                                                index + 1
                                            }:`,
                                            err?.message
                                        );
                                        imageBuffer = undefined;
                                    }

                                    return {
                                        body: "",
                                        footer: `Slide ${index + 1} of ${
                                            res.result.images.length
                                        }`,
                                        title: "",
                                        header: imageBuffer,
                                        buttons: [
                                            builder.button.url({
                                                display: "🔗 View on TikTok",
                                                url: `https://www.tiktok.com/@${res.result.author.username}/video/${res.result.id}`,
                                            }),
                                            builder.button.url({
                                                display: "🖼️ Full Image",
                                                url: imageUrl,
                                            }),
                                            builder.button.copy({
                                                display: "📋 Copy URL",
                                                code: imageUrl,
                                            }),
                                        ],
                                    };
                                }
                            )
                        );

                        const msg = await builder
                            .mainHeader("*「 TIKTOK IMAGES 」*", false)
                            .mainBody(
                                `*「 TIKTOK IMAGES 」*\n\n` +
                                    `• Description: ${res.result.desc}\n` +
                                    `• Total Images: ${res.result.images.length}\n` +
                                    `• Author: ${res.result.author.nickname}\n` +
                                    `• Likes: ${res.result.statistics.diggCount}\n` +
                                    `• Comments: ${res.result.statistics.commentCount}\n\n` +
                                    `Swipe to see all images! 👉`
                            )
                            .mainFooter("Downloaded from TikTok")
                            .cards(cards)
                            .render();

                        await Chisato.relayMessage(from, msg.message, {
                            messageId: msg.key.id,
                        });
                    } else {
                        let str =
                            `*「 TIKTOK IMAGES 」*\n\n` +
                            `• Description: ${res.result.desc}\n` +
                            `• Total Images: ${res.result.images.length}\n` +
                            `• Author: ${res.result.author.nickname}\n` +
                            `• Likes: ${res.result.statistics.diggCount}\n` +
                            `• Comments: ${res.result.statistics.commentCount}\n\n`;

                        await Chisato.sendImage(
                            from,
                            res.result.images[0],
                            str,
                            message
                        );
                    }
                    await Chisato.sendReaction(from, "✅", message.key);
                }
            })
            .catch(async (e) => {
                await Chisato.sendReaction(from, "❌", message.key);
                Chisato.log("error", command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " +
                        e,
                    message
                );
            });
    },
} satisfies ConfigCommands;