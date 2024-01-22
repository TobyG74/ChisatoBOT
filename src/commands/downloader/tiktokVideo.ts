import type { ConfigCommands } from "../../types/commands";
import { TiktokDL } from "@tobyg74/tiktok-api-dl";
import { TiktokAPIResponse } from "@tobyg74/tiktok-api-dl/lib/types/tiktokApi";
import { isURL } from "../../libs";

export default <ConfigCommands>{
    name: "tiktokvideo",
    alias: ["ttv", "tiktokv"],
    usage: "<url>",
    category: "downloader",
    description: "Download Video from Tiktok",
    isProcess: true,
    cooldown: 3,
    example: `• /tiktokvideo https://vt.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        TiktokDL(query, {
            version: "v1",
        })
            .then(async (res: TiktokAPIResponse) => {
                if (res.status === "error") {
                    Chisato.log("error", command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }
                if (res.result.type === "image")
                    return Chisato.sendText(
                        from,
                        `The link / URL you entered was detected by Tiktok Image / Slide. To download it, you can use ${prefix}tiktokimage`,
                        message
                    );
                if (res.result.type === "video") {
                    let str =
                        `*「 TIKTOK VIDEO 」*\n\n` +
                        `• ID: ${res.result.id}\n` +
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
                    await Chisato.sendVideo(from, res.result.video[0], false, str, message);
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
