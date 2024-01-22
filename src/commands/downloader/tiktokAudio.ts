import type { ConfigCommands } from "../../types/commands";
import { TiktokDL } from "@tobyg74/tiktok-api-dl";
import { TiktokAPIResponse } from "@tobyg74/tiktok-api-dl/lib/types/tiktokApi";
import { isURL } from "../../libs";

export default <ConfigCommands>{
    name: "tiktokaudio",
    alias: ["tta", "tiktokmp3"],
    usage: "<url>",
    category: "downloader",
    description: "Download Audio from Tiktok",
    cooldown: 3,
    isProcess: true,
    example: `• /tiktokaudio https://vt.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, query, message, command }) {
        if (!isURL(query)) return Chisato.sendText(from, "Please input a valid url!", message);
        TiktokDL(query, {
            version: "v1",
        })
            .then(async (res: TiktokAPIResponse) => {
                if (res.status === "error") {
                    Chisato.log("error", command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }
                let str =
                    `*「 TIKTOK AUDIO 」*\n\n` +
                    `• ID: ${res.result.id}\n` +
                    `• Create Time: ${res.result.createTime}\n` +
                    `• Description: ${res.result.description}\n\n` +
                    `*「 AUDIO DETAIL 」*\n\n` +
                    `• Title: ${res.result.music.title}\n` +
                    `• Album: ${res.result.music.album}\n` +
                    `• Author: ${res.result.music.author}\n` +
                    `• Duration: ${res.result.music.duration}\n\n` +
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
                await Chisato.sendImage(from, res.result.music.coverLarge[0], str, message);
                await Chisato.sendAudio(from, res.result.music.playUrl[0], false, null, message, {
                    fileName: `${res.result.music.title}.mp3`,
                });
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
