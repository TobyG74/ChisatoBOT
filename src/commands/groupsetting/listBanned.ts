import type { ConfigCommands } from "../../types/commands.js";

export default <ConfigCommands>{
    name: "listbanned",
    alias: ["listban"],
    category: "group setting",
    description: "List Banned Members",
    isGroupAdmin: true,
    async run({ Chisato, from, message, groupSettingData }) {
        if (groupSettingData.banned.length === 0) return Chisato.sendText(from, "There is no banned member!", message);
        let caption = `*「 LIST BANNED 」*\n\n`;
        for (let i = 0; i < groupSettingData.banned.length; i++) {
            caption += `• ${i + 1}. @${groupSettingData.banned[i].split("@")[0]}\n`;
        }
        await Chisato.sendText(from, caption, message, {
            mentions: groupSettingData.banned,
        });
    },
};
