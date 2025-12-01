import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "block",
    alias: ["addblock"],
    usage: "[tag]",
    category: "owner",
    description: "Block User",
    isOwner: true,
    async run({ Chisato, args, from, message, blockList }) {
        const checkUserBlock = (userId: string) => {
            if (blockList.includes(userId)) {
                return Chisato.sendText(from, `@${userId.split("@")[0]} is already on the block list!`, message, {
                    mentions: [userId],
                });
            }
        };
        if (message.quoted) {
            checkUserBlock(message.quoted.sender);
            await Chisato.updateBlockStatus(message.quoted.sender, "block").then(() => {
                Chisato.sendText(from, `Successfully blocked @${message.quoted.sender.split("@")[0]}`, message, {
                    mentions: [message.quoted.sender],
                });
            });
        } else if (message.mentions) {
            let caption = `Successfully blocked `;
            for (let i in message.mentions) {
                checkUserBlock(message.mentions[i]);
                await Chisato.updateBlockStatus(message.mentions[i], "block").then(() => {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                });
            }
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            checkUserBlock(args[0] + "@s.whatsapp.net");
            await Chisato.updateBlockStatus(args[0], "block").then(() => {
                Chisato.sendText(from, `Successfully blocked @${args[0]}`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            });
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
} satisfies ConfigCommands;