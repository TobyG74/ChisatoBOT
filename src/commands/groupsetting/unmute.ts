import type { ConfigCommands } from "../../types/structure/commands";

export default <ConfigCommands>{
    name: "unmute",
    alias: ["unmutebot"],
    category: "group setting",
    description: "Unmute bot in group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let index = await Database.Group.getSettings(from);
        if (index.mute) {
            await Database.Group.updateSettings(from, { mute: false });
            await Chisato.sendText(from, "Successfully unmuted bot", message);
        } else {
            await Chisato.sendText(from, "Bot has been unmuted", message);
        }
    },
};
