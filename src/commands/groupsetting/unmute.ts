import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "unmute",
    alias: ["unmutebot"],
    category: "group setting",
    description: "Unmute bot in group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        let index = await Database.GroupSetting.get(from);
        if (index.mute) {
            await Database.GroupSetting.update(from, { mute: false });
            await Chisato.sendText(from, "Successfully unmuted bot", message);
        } else {
            await Chisato.sendText(from, "Bot has been unmuted", message);
        }
    },
};
