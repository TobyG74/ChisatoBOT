import type { ConfigCommands } from "../../types/commands";
import { TiktokDL } from "@tobyg74/tiktok-api-dl";
import { TiktokAPIResponse } from "@tobyg74/tiktok-api-dl/lib/types/tiktokApi";
import { isURL } from "../../libs";

export default <ConfigCommands>{
    name: "tiktokimage",
    alias: ["tti", "tiktoki", "tiktokslide", "tiktoks"],
    usage: "<url|slide>",
    category: "downloader",
    description: "Download Images from Tiktok",
    isProcess: true,
    cooldown: 3,
    example: `
Download One Image :
• /tiktokimage https://vt.tiktok.com/xxxxxxx|2
Download All Images :
• /tiktokimage https://vt.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, arg, prefix, command, message }) {
        const url = arg.split("|")[0];
        const slide = arg.split("|")[1];
        if (!isURL(url)) return Chisato.sendText(from, "Please input a valid url!", message);
        TiktokDL(url, {
            version: "v1",
        })
            .then(async (res: TiktokAPIResponse) => {
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
                    let str =
                        `*「 TIKTOK SLIDE 」*\n\n` +
                        `• ID: ${res.result.id}\n` +
                        `• Total Images: ${res.result.images.length}\n` +
                        `• Create Time: ${res.result.createTime}\n` +
                        `• Description: ${res.result.description}\n\n` +
                        `*「 AUTHOR 」*\n\n` +
                        `• Username: ${res.result.author.username}\n` +
                        `• Nickname: ${res.result.author.nickname}\n` +
                        `• Bio: ${res.result.author.signature}\n` +
                        `• Region: ${res.result.author.region}\n\n` +
                        `*「 STATISTICS 」*\n\n` +
                        `• Play: ${res.result.statistics.playCount}\n` +
                        `• Downloads: ${res.result.statistics.downloadCount}\n` +
                        `• Share: ${res.result.statistics.shareCount}\n` +
                        `• WhatsApp Share: ${res.result.statistics.whatsappShareCount}\n` +
                        `• Comment: ${res.result.statistics.commentCount}\n` +
                        `• Like: ${res.result.statistics.likeCount}\n` +
                        `• Favorite: ${res.result.statistics.favoriteCount}\n` +
                        `• Reupload: ${res.result.statistics.forwardCount}\n` +
                        `• Lose Comment: ${res.result.statistics.loseCommentCount}\n`;
                    await Chisato.sendText(from, str, message);
                    if (slide) {
                        await Chisato.sendImage(
                            from,
                            res.result.images[Number(slide) - 1],
                            `Image from slide ${slide}`,
                            message
                        );
                    } else {
                        let i = 1;
                        for (let img of res.result.images) {
                            await Chisato.sendImage(from, img, `Image from slide ${i}`, message);
                            i++;
                        }
                    }
                }
            })
            .catch((e) => {
                Chisato.log("error", command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " + e,
                    message
                );
            });
    },
};
