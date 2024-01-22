import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "antiviewonce",
    alias: ["antivo"],
    usage: "<on|off>",
    category: "group setting",
    description: "Anti ViewOnce Message",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Turn on*
• /antiviewonce on

*Turn off*
• /antiviewonce off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.GroupSetting.get(from);
        if (args[0] === "on") {
            if (groupSetting?.antiviewonce) return Chisato.sendText(from, `Anti ViewOnce is already active!`, message);
            await Database.GroupSetting.update(from, { antiviewonce: true });
            await Chisato.sendText(from, `Anti ViewOnce has been activated!`, message);
        } else if (args[0] === "off") {
            if (!groupSetting?.antiviewonce)
                return Chisato.sendText(from, `Anti ViewOnce is already disabled!`, message);
            await Database.GroupSetting.update(from, { antiviewonce: false });
            await Chisato.sendText(from, `Anti ViewOnce has been disabled!`, message);
        } else {
            await Chisato.sendText(from, `Example :\n${command.example}`, message);
        }
    },
};
