import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "unbanned",
    alias: ["unban"],
    category: "group setting",
    usage: "<tag>",
    description: "Unbanned member from group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let user = await Database.GroupSetting.get(from);
        const checkUserBanned = (userId: string) => {
            if (!user.banned.includes(userId)) {
                return Chisato.sendText(from, `@${userId.split("@")[0]} is not on the banned list!`, message, {
                    mentions: [userId],
                });
            }
        };
        if (message.quoted) {
            checkUserBanned(message.quoted.sender);
            user.banned = user.banned.filter((value) => value != message.quoted.sender);
            await Database.GroupSetting.update(from, { banned: user.banned }).then(() => {
                Chisato.sendText(
                    from,
                    `Successfully unbanned @${message.quoted.sender.split("@")[0]} from this Group!`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            });
        } else if (message.mentions) {
            let caption = `Successfully unbanned `;
            for (let i in message.mentions) {
                checkUserBanned(message.mentions[i]);
                user.banned = user.banned.filter((value) => value != message.mentions[i]);
                await Database.GroupSetting.update(from, { banned: user.banned }).then(() => {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                });
            }
            caption += `from this Group!`;
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
