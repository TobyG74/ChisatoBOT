import type { ConfigCommands } from "../../types/structure/commands";
const Tiktok = require("@tobyg74/tiktok-api-dl");
import { Validators } from "../../utils/core";

export default {
    name: "tiktokvideo",
    alias: ["ttv", "tiktokv"],
    usage: "[url]",
    category: "downloader",
    description: "Download Video from Tiktok",
    cooldown: 5,
    limit: 2,
    example: `*「 TIKTOK VIDEO DOWNLOADER 」*

📥 Download TikTok videos!

📝 *How to use:*
{prefix}{command.name} <url>

💡 *Example:*
• {prefix}{command.name} https://vt.tiktok.com/xxxxxxx
• {prefix}{command.alias} https://vm.tiktok.com/xxxxxxx`,
    async run({ Chisato, from, query, prefix, message, command }) {
        if (!query || !Validators.isURL(query)) {
            let text = `*「 TIKTOK VIDEO DOWNLOADER 」*\n\n`;
            text += `📥 Download video dari TikTok!\n\n`;
            text += `📝 *Cara menggunakan:*\n`;
            text += `${prefix}${command.name} [url]\n\n`;
            text += `💡 *Contoh:*\n`;
            text += `• ${prefix}${command.name} https://vt.tiktok.com/xxxxxxx\n`;
            text += `• ${prefix}ttv https://www.tiktok.com/@user/video/xxxxx`;
            
            return Chisato.sendText(from, text, message);
        }
        
        await Chisato.sendReaction(from, "⏳", message.key);
        Tiktok.Downloader(query, {
            version: "v1",
        })
            .then(async (res) => {
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
                        `• Description: ${res.result.desc}\n\n` +
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
                    await Chisato.sendVideo(
                        from,
                        res.result.video.playAddr[0],
                        false,
                        str,
                        message
                    );
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