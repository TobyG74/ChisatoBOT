import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "memberleave",
    alias: ["mleft"],
    usage: "<on|off>",
    category: "group setting",
    description: "Greet new group members who have just left",
    isGroup: true,
    isGroupAdmin: true,
    example: `
*Turn On*
• /mleave on

*Turn Off*
• /mleave off`,
    async run({ Chisato, args, from, message, Database, isBotAdmin }) {
        if (!isBotAdmin)
            return Chisato.sendText(
                from,
                "Hello, Currently Chisato is not a group admin. Please make the group admin so that the notify command works!",
                message
            );
        let index = await Database.GroupSetting.get(from);
        if (args[0] === "on") {
            if (index.leave) {
                await Chisato.sendText(from, "Leave Group has been previously activated", message);
            } else {
                await Database.GroupSetting.update(from, { leave: true });
                await Chisato.sendText(from, "Successfully activated Leave Group", message);
            }
        } else if (args[0] === "off") {
            if (!index.leave) {
                await Chisato.sendText(from, "Leave Group has not been activated previously", message);
            } else {
                await Database.GroupSetting.update(from, { leave: false });
                await Chisato.sendText(from, "Successfully deactivated Leave Group", message);
            }
        }
    },
};
