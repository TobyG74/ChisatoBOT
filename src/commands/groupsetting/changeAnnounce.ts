import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "announce",
    alias: ["groupannounce", "changeannounce"],
    usage: "<on|off>",
    category: "group setting",
    description: "Change Group Announcement",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Option :* on | off 

*Turn on*
/announce on

*Turn off*
/announce off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.Group.get(from);
        switch (args[0]) {
            case "on":
                if (groupSetting?.announce) return Chisato.sendText(from, `Announcement already on!`, message);
                await Chisato.groupSettingUpdate(from, "announcement");
                await Database.Group.update(from, {
                    announce: true,
                });
                return Chisato.sendText(from, `Group Announcement turned on!`, message);
            case "off":
                if (!groupSetting?.announce) return Chisato.sendText(from, `Announcement already off!`, message);
                await Chisato.groupSettingUpdate(from, "not_announcement");
                await Database.Group.update(from, {
                    announce: false,
                });
                return Chisato.sendText(from, `Group Announcement turned off!`, message);
            default:
                return Chisato.sendText(from, `Option not found!\n\n${command.example}`, message);
        }
    },
};
