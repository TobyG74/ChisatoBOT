import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "memberwelcome",
    alias: ["memberwc"],
    usage: "<on|off>",
    category: "group setting",
    description: "Welcome Group Members who have just joined",
    isGroup: true,
    isGroupAdmin: true,
    example: `
*Turn On*
• /memberwc on

*Turn Off*
• /memberwc off`,
    async run({ Chisato, args, from, message, Database, isBotAdmin }) {
        if (!isBotAdmin)
            return Chisato.sendText(
                from,
                "Hello, Currently Chisato is not a group admin. Please make the group admin so that the notify command works!",
                message
            );
        let index = await Database.GroupSetting.get(from);
        if (args[0] === "on") {
            if (index.welcome) {
                await Chisato.sendText(from, "Welcome Group has been previously activated", message);
            } else {
                await Database.GroupSetting.update(from, { welcome: true });
                await Chisato.sendText(from, "Successfully activated Welcome Group", message);
            }
        } else if (args[0] === "off") {
            if (!index.welcome) {
                await Chisato.sendText(from, "Welcome Group has not been activated previously", message);
            } else {
                await Database.GroupSetting.update(from, { welcome: false });
                await Chisato.sendText(from, "Successfully deactivated Welcome Group", message);
            }
        }
    },
};
