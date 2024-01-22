import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "unbanned",
    alias: ["unban"],
    category: "group setting",
    usage: "<tag>",
    description: "Unbanned member from group",
    isGroup: true,
    async run({ Chisato, from, message, Database, sender }) {
        let user = await Database.GroupSetting.get(from);
        if (message.quoted) {
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
