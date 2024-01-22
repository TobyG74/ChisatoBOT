import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "banned",
    alias: ["ban"],
    category: "group setting",
    usage: "<tag>",
    description: "Banned member from group",
    isGroup: true,
    async run({ Chisato, from, query, message, Database, sender }) {
        let user = await Database.GroupSetting.get(from);
        if (message.quoted) {
            user.banned.push(message.quoted.sender);
            await Database.GroupSetting.update(from, { banned: user.banned }).then(() => {
                Chisato.sendText(
                    from,
                    `Successfully banned @${message.quoted.sender.split("@")[0]} from this Group!`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            });
        } else if (message.mentions) {
            let caption = `Successfully banned `;
            for (let i in message.mentions) {
                user.banned.push(message.mentions[i]);
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
