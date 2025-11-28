import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "unbanned",
    alias: ["unban"],
    category: "group setting",
    usage: "<tag>",
    description: "Unbanned member from group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let user = await Database.Group.getSettings(from);

        if (!user.banned) {
            user.banned = [];
        }

        const checkUserNotBanned = (userId: string): boolean => {
            if (!user.banned?.includes(userId)) {
                Chisato.sendText(
                    from,
                    `@${userId.split("@")[0]} is not on the banned list!`,
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
            if (checkUserNotBanned(message.quoted.sender)) {
                return;
            }
            user.banned = user.banned.filter(
                (value) => value !== message.quoted.sender
            );
            await Database.Group.updateSettings(from, {
                banned: user.banned,
            });
            await Chisato.sendText(
                from,
                `Successfully unbanned @${
                    message.quoted.sender.split("@")[0]
                } from this Group!`,
                message,
                {
                    mentions: [message.quoted.sender],
                }
            );
        } else if (message.mentions) {
            let unbannedUsers: string[] = [];
            for (let userId of message.mentions) {
                if (!checkUserNotBanned(userId)) {
                    user.banned = user.banned.filter((value) => value !== userId);
                    unbannedUsers.push(userId);
                }
            }
            
            if (unbannedUsers.length > 0) {
                await Database.Group.updateSettings(from, {
                    banned: user.banned,
                });
                let caption = `Successfully unbanned ${unbannedUsers.map(u => `@${u.split("@")[0]}`).join(", ")} from this Group!`;
                await Chisato.sendText(from, caption, message, {
                    mentions: unbannedUsers,
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