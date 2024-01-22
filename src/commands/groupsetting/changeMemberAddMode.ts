import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "addmode",
    alias: ["addmember"],
    usage: "<on|off>",
    category: "group setting",
    description: "Add Other Members",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Option :* on | off 

*Change the Add Other Members setting to All Members*
/addmode on

*Change the Add Other Members setting to Admin*
/addmode off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.Group.get(from);
        switch (args[0]) {
            case "on":
                if (groupSetting?.memberAddMode)
                    return Chisato.sendText(from, `GroupAddMode is still set to All Participants`, message);
                await Chisato.groupSettingUpdate(from, "all_member_add");
                await Database.Group.update(from, {
                    memberAddMode: true,
                });
                return Chisato.sendText(from, `The Add Other Members setting is now set to All Participants!`, message);
            case "off":
                if (!groupSetting?.memberAddMode)
                    return Chisato.sendText(from, `GroupAddMode is still set to Admin!`, message);
                await Chisato.groupSettingUpdate(from, "admin_add");
                await Database.Group.update(from, {
                    memberAddMode: false,
                });
                return Chisato.sendText(from, `The Add Other Members setting is now set to Admin!`, message);
            default:
                return Chisato.sendText(from, `Option not found!\n\n${command.example}`, message);
        }
    },
};
