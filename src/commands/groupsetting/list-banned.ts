import type { ConfigCommands } from "../../types/structure/commands.js";

export default {
    name: "listbanned",
    alias: ["listban"],
    usage: "",
    category: "group setting",
    description: "List Banned Members",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let user = await Database.Group.getSettings(from);
        
        if (!user.banned || user.banned.length === 0) {
            return Chisato.sendText(
                from,
                "There is no banned member!",
                message
            );
        }

        let caption = `*「 LIST BANNED 」*\n\n`;
        for (let i = 0; i < user.banned.length; i++) {
            caption += `• ${i + 1}. @${
                user.banned[i].split("@")[0]
            }\n`;
        }
        await Chisato.sendText(from, caption, message, {
            mentions: user.banned,
        });
    },
} satisfies ConfigCommands;