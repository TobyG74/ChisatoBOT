import type { ConfigCommands } from "../../types/structure/commands";
import { getLevelInfo, formatLevelDisplay, getRankInfo } from "../../utils/leveling";

export default {
    name: "me",
    alias: ["myprofile", "myinfo"],
    usage: "",
    category: "general",
    description: "View your profile, stats, and level",
    async run({ Chisato, sender, isOwner, from, message, userMetadata, groupSettingData, isGroup, Database }) {
        const fetchStatus = await Chisato.fetchStatus(sender).catch(() => void 0);
        
        // Get level info with fallback for null values
        const level = userMetadata.level?.level || 1;
        const xp = userMetadata.level?.xp || 0;
        const totalXp = userMetadata.level?.totalXp || 0;
        
        const levelInfo = getLevelInfo(level, xp, totalXp);
        const isPremium = userMetadata.role === "premium";
        
        let caption = "*「 YOUR PROFILE 」*\n\n";
        caption += `👤 *Name:* ${message.pushName}\n`;
        caption += `📱 *Number:* ${sender.replace(/@s.whatsapp.net/g, "")}\n`;
        caption += `📝 *Status:* ${fetchStatus?.status || "-"}\n`;
        caption += `${isPremium ? "⭐ *Premium User*\n" : ""}`;
        caption += `🎭 *Role:* ${isOwner ? "Owner" : userMetadata.role}\n`;
        caption += `💎 *Limit:* ${isOwner ? "Unlimited" : isPremium ? "Unlimited" : userMetadata.limit}\n`;
        
        if (isGroup && groupSettingData) {
            caption += `🚫 *Banned:* ${groupSettingData.banned?.includes(sender) ? "YES" : "NO"}\n`;
        }
        
        caption += `\n*「 LEVEL & RANK 」*\n\n`;
        caption += formatLevelDisplay(levelInfo);
        
        // Stats
        const stats = userMetadata.stats;
        caption += `\n\n*「 STATISTICS 」*\n\n`;
        caption += `📊 *Total Commands:* ${stats?.totalCommands || 0}\n`;
        caption += `📅 *Join Date:* ${stats?.joinedAt ? new Date(stats.joinedAt * 1000).toLocaleDateString() : "Unknown"}\n`;
        
        // Top 3 most used commands
        if (stats?.commandsUsed && stats.commandsUsed.length > 0) {
            const sortedCommands = [...stats.commandsUsed]
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 3);
            
            caption += `\n🏅 *Most Used Commands:*\n`;
            sortedCommands.forEach((cmd: any, idx: number) => {
                caption += `${idx + 1}. ${cmd.command} - ${cmd.count}x\n`;
            });
        }
        
        caption += `\n💡 Use commands to gain XP and level up!`;

        try {
            const profile = await Chisato.profilePictureUrl(sender, "image");
            await Chisato.sendImage(from, profile, caption, message);
        } catch {
            await Chisato.sendText(from, caption, message);
        }
    },
} satisfies ConfigCommands;