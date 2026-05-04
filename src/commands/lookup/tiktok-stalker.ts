import type { ConfigCommands } from "../../types/structure/commands";
import { StalkUser } from "@tobyg74/tiktok-api-dl";

export default {
    name: "tiktokstalk",
    alias: ["ttstalk", "tiktoklookup", "tiktokstalker", "ttlookup"],
    usage: "[username]",
    category: "lookup",
    description: "Lookup TikTok user profile information",
    cooldown: 5,
    limit: 1,
    example: `*「 TIKTOK STALKER 」*

🔍 Lookup profil pengguna TikTok!

📝 *Cara menggunakan:*
{prefix}{command.name} [username]

💡 *Contoh:*
• {prefix}{command.name} tobyg74
• {prefix}ttstalk username`,
    async run({ Chisato, from, query, prefix, message, command }) {
        const username = query.startsWith("@") ? query.substring(1) : query;
        
        await Chisato.sendReaction(from, "⏳", message.key);
        
        try {
            const res = await StalkUser(username);
            
            if (res.status === "error") {
                await Chisato.sendReaction(from, "❌", message.key);
                Chisato.logger.error(command.name, res.message);
                return Chisato.sendText(from, res.message, message);
            }
            
            const user = res.result.user;
            const stats = res.result.stats;
            
            let caption = `*「 TIKTOK USER INFO 」*\n\n`;
            caption += `*「 PROFILE 」*\n`;
            caption += `• Username: @${user.username}\n`;
            caption += `• Nickname: ${user.nickname}\n`;
            caption += `• Bio: ${user.signature || "-"}\n`;
            caption += `• Verified: ${user.verified ? "✅" : "❌"}\n`;
            caption += `• Private: ${user.privateAccount ? "🔒 Yes" : "🔓 No"}\n`;
            caption += `• Region: ${user.region || "-"}\n\n`;
            
            caption += `*「 STATISTICS 」*\n`;
            caption += `• Followers: ${stats.followerCount.toLocaleString()}\n`;
            caption += `• Following: ${stats.followingCount.toLocaleString()}\n`;
            caption += `• Total Videos: ${stats.videoCount.toLocaleString()}\n`;
            caption += `• Total Likes: ${stats.heartCount.toLocaleString()}\n`;
            caption += `• Total Friends: ${stats.friendCount.toLocaleString()}\n\n`;
            
            caption += `*「 LINKS 」*\n`;
            caption += `• Profile: https://www.tiktok.com/@${user.username}\n`;
            
            if (user.avatarLarger) {
                await Chisato.sendImage(
                    from,
                    user.avatarLarger,
                    caption,
                    message
                );
            } else {
                await Chisato.sendText(from, caption, message);
            }
            
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (e: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, e);
            Chisato.sendText(
                from,
                "There is an error. Please report it to the bot creator immediately!\nMessage: " +
                    e.message,
                message
            );
        }
    },
} satisfies ConfigCommands;
