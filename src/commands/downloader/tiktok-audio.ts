import type { ConfigCommands } from "../../types/structure/commands";
import Tiktok from "@tobyg74/tiktok-api-dl";
import { Validators } from "../../utils/core";

export default {
    name: "tiktokaudio",
    alias: ["tta", "tiktokmp3"],
    usage: "[url]",
    category: "downloader",
    description: "Download Audio from Tiktok",
    cooldown: 3,
    limit: 1,
    example: `• {prefix}{command.name} https://vt.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!query || !Validators.isURL(query)) {
            let text = `*「 TIKTOK AUDIO DOWNLOADER 」*\n\n`;
            text += `🎵 Download audio dari TikTok!\n\n`;
            text += `📝 *Cara menggunakan:*\n`;
            text += `${prefix}${command.name} [url]\n\n`;
            text += `💡 *Contoh:*\n`;
            text += `• ${prefix}${command.name} https://vt.tiktok.com/xxxxxxx\n`;
            text += `• ${prefix}tta https://www.tiktok.com/@user/video/xxxxx`;
            
            return Chisato.sendText(from, text, message);
        }
        
        await Chisato.sendReaction(from, "⏳", message.key);
        Tiktok.Downloader(query, {
            version: "v1",
        })
            .then(async (res) => {
                if (res.status === "error") {
                    Chisato.logger.error(command.name, res.message);
                    return Chisato.sendText(from, res.message, message);
                }
                let str =
                    `*「 TIKTOK AUDIO 」*\n\n` +
                    `• ID: ${res.result.id}\n` +
                    `• Create Time: ${res.result.createTime}\n` +
                    `• Description: ${res.result.desc}\n\n` +
                    `*「 AUDIO DETAIL 」*\n\n` +
                    `• Title: ${res.result.music.title}\n` +
                    `• Album: ${res.result.music.album}\n` +
                    `• Author: ${res.result.music.author}\n` +
                    `• Duration: ${res.result.music.duration}\n\n` +
                    `*「 AUTHOR 」*\n\n` +
                    `• Nickname: ${res.result.author.nickname}\n` +
                    `• Bio: ${res.result.author.signature}\n` +
                    `• Region: ${res.result.author.region}\n\n` +
                    `*「 STATISTICS 」*\n\n` +
                    `• Play: ${res.result.statistics.playCount}\n` +
                    `• Downloads: ${res.result.statistics.downloadCount}\n` +
                    `• Share: ${res.result.statistics.shareCount}\n` +
                    `• Comment: ${res.result.statistics.commentCount}\n` +
                    `• Like: ${res.result.statistics.likeCount}\n`;
                await Chisato.sendImage(
                    from,
                    res.result.music.coverLarge[0],
                    str,
                    message
                );
                await Chisato.sendAudio(
                    from,
                    res.result.music.playUrl[0],
                    false,
                    null,
                    message,
                    {
                        fileName: `${res.result.music.title}.mp3`,
                    }
                );
                await Chisato.sendReaction(from, "✅", message.key);
                })
            .catch(async (e) => {
                await Chisato.sendReaction(from, "❌", message.key);
                Chisato.logger.error(command.name, e);
                Chisato.sendText(
                    from,
                    "There is an error. Please report it to the bot creator immediately!\nMessage : " +
                        e,
                    message
                );
            });
    },
} satisfies ConfigCommands;