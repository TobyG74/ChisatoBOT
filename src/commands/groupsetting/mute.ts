import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "mute",
    alias: ["mutebot"],
    usage: "",
    category: "group setting",
    description: "Mute bot in group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, prefix, message, Database }) {
        let index = await Database.Group.getSettings(from);
        if (!index.mute) {
            await Database.Group.updateSettings(from, { mute: true });
            await Chisato.sendText(from, `Successfully muted bot. To unmute, use the ${prefix}unmute command.`, message);
        } else {
            await Chisato.sendText(from, `Bot is already muted. To unmute, use the ${prefix}unmute command.`, message);
        }
    },
} satisfies ConfigCommands;