import type { ConfigCommands } from "../../types/structure/commands";

export default <ConfigCommands>{
    name: "mute",
    alias: ["mutebot"],
    category: "group setting",
    description: "Mute bot in group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let index = await Database.Group.getSettings(from);
        if (!index.mute) {
            await Database.Group.updateSettings(from, { mute: true });
            await Chisato.sendText(from, "Successfully muted bot", message);
        } else {
            await Chisato.sendText(from, "Bot has been muted", message);
        }
    },
};
