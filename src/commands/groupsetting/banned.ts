import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "banned",
    alias: ["ban"],
    category: "group setting",
    usage: "[tag]",
    description: "Banned member from group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, query, message, Database, sender }) {
        let user = await Database.Group.getSettings(from);

        if (!user.banned) {
            user.banned = [];
        }

        const checkUserBanned = (userId: string): boolean => {
            if (user.banned?.includes(userId)) {
                Chisato.sendText(
                    from,
                    `@${userId.split("@")[0]} is already on the banned list!`,
                    message,
                    {
                        mentions: [userId],
                    }
                );
                return true;
            }
            return false;
        };

        if (message.quoted) {
            if (checkUserBanned(message.quoted.sender)) {
                return;
            }
            user.banned.push(message.quoted.sender);
            await Database.Group.updateSettings(from, {
                banned: user.banned,
            });
            await Chisato.sendText(
                from,
                `Successfully banned @${
                    message.quoted.sender.split("@")[0]
                } from this Group!`,
                message,
                {
                    mentions: [message.quoted.sender],
                }
            );
        } else if (message.mentions) {
            let bannedUsers: string[] = [];
            for (let userId of message.mentions) {
                if (!checkUserBanned(userId)) {
                    user.banned.push(userId);
                    bannedUsers.push(userId);
                }
            }
            
            if (bannedUsers.length > 0) {
                await Database.Group.updateSettings(from, {
                    banned: user.banned,
                });
                let caption = `Successfully banned ${bannedUsers.map(u => `@${u.split("@")[0]}`).join(", ")} from this Group!`;
                await Chisato.sendText(from, caption, message, {
                    mentions: bannedUsers,
                });
            }
        } else {
            await Chisato.sendText(
                from,
                "Please tag user or reply message!",
                message
            );
        }
    },
} satisfies ConfigCommands;