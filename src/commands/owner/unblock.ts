import type { ConfigCommands } from "../../types/structure/commands";

export default <ConfigCommands>{
    name: "unblock",
    alias: ["addunblock"],
    usage: "<tag>",
    category: "owner",
    description: "Unblock User",
    isOwner: true,
    async run({ Chisato, args, from, message, blockList }) {
        const checkUserBlock = (userId: string) => {
            if (!blockList.includes(userId)) {
                return Chisato.sendText(from, `@${userId.split("@")[0]} is not on the block list!`, message, {
                    mentions: [userId],
                });
            }
        };
        if (message.quoted) {
            checkUserBlock(message.quoted.sender);
            await Chisato.updateBlockStatus(message.quoted.sender, "unblock").then(() => {
                Chisato.sendText(
                    from,
                    `Successfully opened the block @${message.quoted.sender.split("@")[0]}`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            });
        } else if (message.mentions) {
            let caption = `Successfully opened the block `;
            for (let i in message.mentions) {
                checkUserBlock(message.mentions[i]);
                await Chisato.updateBlockStatus(message.mentions[i], "unblock").then(() => {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                });
            }
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            checkUserBlock(args[0] + "@s.whatsapp.net");
            await Chisato.updateBlockStatus(args[0] + "@s.whatsapp.net", "unblock").then(() => {
                Chisato.sendText(from, `Successfully opened the block @${args[0]}`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            });
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
