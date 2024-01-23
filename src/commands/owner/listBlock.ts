import type { ConfigCommands } from "../../types/commands.js";

export default <ConfigCommands>{
    name: "listblock",
    alias: ["listblok"],
    category: "owner",
    description: "List Blocked User",
    isOwner: true,
    async run({ Chisato, from, message, blockList }) {
        if (blockList.length === 0) return Chisato.sendText(from, "There is no blocked user!", message);
        let caption = `*「 LIST BLOCK 」*\n\n`;
        for (let i = 0; i < blockList.length; i++) {
            caption += `• ${i + 1}. @${blockList[i].split("@")[0]}\n`;
        }
        await Chisato.sendText(from, caption, message, {
            mentions: blockList,
        });
    },
};
