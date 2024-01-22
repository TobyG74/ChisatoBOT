import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "restrict",
    alias: ["grouprestrict", "changerestrict"],
    usage: "<on|off>",
    category: "group setting",
    description: "Change Group Restrict",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Option :* on | off 

*Turn on*
/restrict on

*Turn off*
/restrict off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.Group.get(from);
        switch (args[0]) {
            case "on":
                if (groupSetting?.restrict) return Chisato.sendText(from, `Restrict already on!`, message);
                await Chisato.groupSettingUpdate(from, "locked");
                await Database.Group.update(from, {
                    restrict: true,
                });
                return Chisato.sendText(from, `Group Restrict turned on!`, message);
            case "off":
                if (!groupSetting?.restrict) return Chisato.sendText(from, `Restrict already off!`, message);
                await Chisato.groupSettingUpdate(from, "unlocked");
                await Database.Group.update(from, {
                    restrict: false,
                });
                return Chisato.sendText(from, `Group Restrict turned off!`, message);
            default:
                return Chisato.sendText(from, `Option not found!\n\n${command.example}`, message);
        }
    },
};
