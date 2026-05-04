import type { ConfigCommands } from "../../types/structure/commands";
import { getLevelInfo, formatLevelDisplay } from "../../utils/leveling";

export default {
    name: "level",
    alias: ["lvl", "rank", "xp"],
    category: "general",
    usage: "[tag]",
    description: "Check your current level, XP, and rank",
    cooldown: 5,
    async run({ Chisato, from, message, Database, args, prefix, command }) {
        const targetUser = message.mentions[0] || message.sender;
        const isOwnProfile = targetUser === message.sender;

        if (args.length > 0 && message.mentions.length === 0) {
            const infoMessage = `*「 LEVEL 」*

📊 Check your level and progress!

💡 *Usage:*
${prefix}${command.name} - Check your level
${prefix}${command.name} @user - Check someone's level

📈 *How to level up:*
• Use bot commands to gain XP
• Different commands give different XP
• Premium users get 50% XP bonus

🏆 *Ranks:*
• 🌱 Beginner (Lv 1-4)
• 🎯 Novice (Lv 5-14)
• 🥉 Intermediate (Lv 15-24)
• 🎖️ Advanced (Lv 25-39)
• 💎 Expert (Lv 40-59)
• ⭐ Master (Lv 60-79)
• 🔮 Mythical (Lv 80-99)
• 👑 Legendary (Lv 100+)`
            return Chisato.sendText(from, infoMessage, message);
        }

        try {
            const userData = await Database.User.get(targetUser);
            
            if (!userData) {
                return Chisato.sendText(
                    from,
                    `❌ User data not found!`,
                    message
                );
            }
            
            const levelInfo = getLevelInfo(
                userData.level?.level || 1,
                userData.level?.xp || 0,
                userData.level?.totalXp || 0
            );
            
            const username = userData.name || targetUser.split("@")[0];
            const isPremium = userData.role === "premium";
            
            let text = `*「 ${isOwnProfile ? "YOUR" : "USER"} LEVEL 」*\n\n`;
            text += `👤 *Name:* ${username}\n`;
            text += `${isPremium ? "⭐ *Premium User*\n" : ""}\n`;
            text += formatLevelDisplay(levelInfo);
            text += `\n\n📊 *Statistics:*\n`;
            text += `• Total Commands: ${userData.stats?.totalCommands || 0}\n`;
            text += `• Join Date: ${userData.stats?.joinedAt ? new Date(userData.stats.joinedAt * 1000).toLocaleDateString() : "Unknown"}\n`;
            
            // Show top 3 most used commands
            if (userData.stats?.commandsUsed && userData.stats.commandsUsed.length > 0) {
                const sortedCommands = [...userData.stats.commandsUsed]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 3);
                
                text += `\n🏅 *Most Used Commands:*\n`;
                sortedCommands.forEach((cmd, idx) => {
                    text += `${idx + 1}. ${cmd.command} - ${cmd.count}x\n`;
                });
            }
            
            await Chisato.sendText(from, text, message);
        } catch (error) {
            Chisato.logger.error(`Level command error:`, error);
            await Chisato.sendText(
                from,
                "❌ Failed to retrieve level information. Please try again.",
                message
            );
        }
    },
} satisfies ConfigCommands;
