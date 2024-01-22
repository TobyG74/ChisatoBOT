import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "antibot",
    alias: ["autokickbot"],
    usage: "<on|off>",
    category: "group setting",
    description: "Anti Bot Protect",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Turn on*
• /antibot on

*Turn off*
• /antibot off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.GroupSetting.get(from);
        if (args[0] === "on") {
            if (groupSetting?.antibot) return Chisato.sendText(from, `Anti Bot is already active!`, message);
            await Database.GroupSetting.update(from, { antibot: true });
            await Chisato.sendText(from, `Anti Bot has been activated!`, message);
        } else if (args[0] === "off") {
            if (!groupSetting?.antibot) return Chisato.sendText(from, `Anti Bot is already disabled!`, message);
            await Database.GroupSetting.update(from, { antibot: false });
            await Chisato.sendText(from, `Anti Bot has been disabled!`, message);
        } else {
            await Chisato.sendText(from, `Example :\n${command.example}`, message);
        }
    },
};
