import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "stats",
    alias: ["mystats", "statistics"],
    category: "general",
    usage: "[tag]",
    description: "View your detailed statistics and command usage",
    cooldown: 5,
    async run({ Chisato, from, message, Database, args, prefix, command }) {
        const targetUser = message.mentions[0] || message.sender;
        const isOwnProfile = targetUser === message.sender;

        if (args.length > 0 && message.mentions.length === 0) {
            const infoMessage = `*「 STATISTICS 」*

📊 View your detailed bot usage statistics!

💡 *Usage:*
${prefix}${command.name} - View your stats
${prefix}${command.name} @user - View someone's stats

📈 *What you'll see:*
• Total commands used
• Most used commands
• Join date
• Level and XP progress
• Activity timeline`
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
            
            const username = userData.name || targetUser.split("@")[0];
            const isPremium = userData.role === "premium";
            
            let text = `*「 ${isOwnProfile ? "YOUR" : "USER"} STATISTICS 」*\n\n`;
            text += `👤 *User:* ${username}\n`;
            text += `🆔 *ID:* ${targetUser.split("@")[0]}\n`;
            text += `${isPremium ? "⭐ *Status:* Premium\n" : "🎯 *Status:* Free\n"}`;
            text += `📅 *Joined:* ${userData.stats?.joinedAt ? new Date(userData.stats.joinedAt * 1000).toLocaleDateString() : "Unknown"}\n\n`;
            
            text += `*「 📊 COMMAND USAGE 」*\n\n`;
            text += `• Total Commands: ${userData.stats?.totalCommands || 0}\n`;
            
            if (userData.stats?.lastCommandTime) {
                const lastUsed = new Date(userData.stats.lastCommandTime * 1000);
                text += `• Last Command: ${lastUsed.toLocaleString()}\n`;
            }
            
            if (userData.stats?.commandsUsed && userData.stats.commandsUsed.length > 0) {
                const sortedCommands = [...userData.stats.commandsUsed]
                    .sort((a, b) => b.count - a.count);
                
                text += `\n*「 🏅 TOP COMMANDS 」*\n\n`;
                
                const topCommands = sortedCommands.slice(0, 10);
                topCommands.forEach((cmd, idx) => {
                    const percentage = ((cmd.count / (userData.stats?.totalCommands || 1)) * 100).toFixed(1);
                    text += `${idx + 1}. *.${cmd.command}* - ${cmd.count}x (${percentage}%)\n`;
                });
                
                if (sortedCommands.length > 10) {
                    text += `\n_...and ${sortedCommands.length - 10} more commands_`;
                }
            } else {
                text += `\n_No commands used yet_`;
            }
            
            if (userData.level) {
                const { getLevelInfo, formatLevelDisplay } = await import("../../utils/leveling");
                const levelInfo = getLevelInfo(
                    userData.level.level,
                    userData.level.xp,
                    userData.level.totalXp
                );
                
                text += `\n\n*「 ⚡ LEVEL INFO 」*\n\n`;
                text += formatLevelDisplay(levelInfo);
            }
            
            await Chisato.sendText(from, text, message);
        } catch (error) {
            Chisato.logger.error(`Stats command error:`, error);
            await Chisato.sendText(
                from,
                "❌ Failed to retrieve statistics. Please try again.",
                message
            );
        }
    },
} satisfies ConfigCommands;
