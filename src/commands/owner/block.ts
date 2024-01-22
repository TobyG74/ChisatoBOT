import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "block",
    alias: ["addblock"],
    usage: "<tag>",
    category: "owner",
    description: "Block User",
    isOwner: true,
    async run({ Chisato, args, from, message }) {
        if (message.quoted) {
            await Chisato.updateBlockStatus(message.quoted.sender, "block").then(() => {
                Chisato.sendText(from, `Successfully blocked @${message.quoted.sender.split("@")[0]}`, message, {
                    mentions: [message.quoted.sender],
                });
            });
        } else if (message.mentions) {
            let caption = `Successfully blocked `;
            for (let i in message.mentions) {
                await Chisato.updateBlockStatus(message.mentions[i], "block").then(() => {
                    caption += `@${message.mentions[i].split("@")[0]} `;
                });
            }
            await Chisato.sendText(from, caption, message, {
                mentions: message.mentions,
            });
        } else if (args[0]) {
            await Chisato.updateBlockStatus(args[0], "block").then(() => {
                Chisato.sendText(from, `Successfully blocked @${args[0]}`, message, {
                    mentions: [args[0] + "@s.whatsapp.net"],
                });
            });
        } else {
            Chisato.sendText(from, "Please tag user or reply message!", message);
        }
    },
};
