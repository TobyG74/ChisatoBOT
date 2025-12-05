import type { ConfigCommands } from "../../types/structure/commands";
import { getLevelInfo, getPositionSuffix } from "../../utils/leveling";

export default {
    name: "leaderboard",
    alias: ["lb", "top", "topusers"],
    category: "general",
    usage: "[number]",
    description: "View the top users ranked by level and XP",
    cooldown: 10,
    async run({ Chisato, from, message, Database, args, prefix, command }) {
        
        if (args.length > 0 && isNaN(parseInt(args[0]))) {
            const infoMessage = `*「 LEADERBOARD 」*

🏆 See who's at the top!

💡 *Usage:*
${prefix}${command.name} - View top 10 users
${prefix}${command.name} [number] - View specific amount

📋 *Example:*
${prefix}${command.name}
${prefix}${command.name} 20`
            return Chisato.sendText(from, infoMessage, message);
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            
            const limit = Math.min(parseInt(args[0]) || 10, 50);
            
            const allUsers = await Database.User.getAll();
            
            if (!allUsers || allUsers.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    `❌ No user data available yet!`,
                    message
                );
            }
            
            const botNumber = await Chisato.decodeJid(Chisato.user.id);
            
            const sortedUsers = allUsers
                .filter(user => {
                    return user.userId !== botNumber && 
                           user.level && 
                           user.level.totalXp > 0;
                })
                .sort((a, b) => (b.level?.totalXp || 0) - (a.level?.totalXp || 0))
                .slice(0, limit);
            
            if (sortedUsers.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    `❌ No ranked users found!`,
                    message
                );
            }
            
            const currentUserIndex = sortedUsers.findIndex(u => u.userId === message.sender);
            const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;
            
            let text = `*「 🏆 LEADERBOARD 」*\n\n`;
            text += `📊 Top ${sortedUsers.length} Users\n\n`;
            
            const mentions: string[] = [];
            
            sortedUsers.forEach((user, index) => {
                const position = index + 1;
                const levelInfo = getLevelInfo(
                    user.level?.level || 1,
                    user.level?.xp || 0,
                    user.level?.totalXp || 0
                );
                
                let medal = "";
                if (position === 1) medal = "🥇";
                else if (position === 2) medal = "🥈";
                else if (position === 3) medal = "🥉";
                else medal = `${position}.`;
                
                const isCurrentUser = user.userId === message.sender;
                const marker = isCurrentUser ? "👉 " : "";
                
                mentions.push(user.userId);
                
                text += `${marker}${medal} ${levelInfo.rankEmoji} @${user.userId.split("@")[0]}\n`;
                text += `   Lv ${levelInfo.level} • ${levelInfo.totalXp.toLocaleString()} XP\n`;
                
                if (index < sortedUsers.length - 1) {
                    text += `\n`;
                }
            });
            
            if (currentUserRank && currentUserRank > limit) {
                const currentUser = await Database.User.get(message.sender);
                if (currentUser && currentUser.level) {
                    const levelInfo = getLevelInfo(
                        currentUser.level.level,
                        currentUser.level.xp,
                        currentUser.level.totalXp
                    );
                    
                    text += `\n\n${"─".repeat(30)}\n`;
                    text += `👤 *Your Rank:* ${getPositionSuffix(currentUserRank)}\n`;
                    text += `${levelInfo.rankEmoji} Level ${levelInfo.level} • ${levelInfo.totalXp.toLocaleString()} XP`;
                }
            }
            
            text += `\n\n💡 Use commands to gain XP and climb the ranks!`;
            
            await Chisato.sendText(from, text, message, { mentions });
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.log("error", `Leaderboard command error:`, error);
            await Chisato.sendText(
                from,
                "❌ Failed to retrieve leaderboard. Please try again.",
                message
            );
        }
    },
} satisfies ConfigCommands;
