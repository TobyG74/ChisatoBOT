import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "approval",
    alias: ["approvalmode"],
    usage: "<on|off>",
    category: "group setting",
    description: "Approval to Join Group",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Option :* on | off 

*Enable Admin Approval to Join Groups*
/approval on

*Disable Admin Approval to Join Groups*
/approval off`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.Group.get(from);
        switch (args[0]) {
            case "on":
                if (groupSetting?.approval)
                    return Chisato.sendText(from, `GroupAddMode is still set to All Participants`, message);
                await Chisato.groupSettingUpdate(from, "all_member_add");
                await Database.Group.update(from, {
                    approval: true,
                });
                return Chisato.sendText(
                    from,
                    `Approval to join a group from now on requires a request to the Group Admin!`,
                    message
                );
            case "off":
                if (!groupSetting?.approval)
                    return Chisato.sendText(from, `GroupAddMode is still set to Admin!`, message);
                await Chisato.groupSettingUpdate(from, "admin_add");
                await Database.Group.update(from, {
                    approval: false,
                });
                return Chisato.sendText(
                    from,
                    `Group Join Approval has been disabled and no approval from the Group Admin is required!`,
                    message
                );
            default:
                return Chisato.sendText(from, `Option not found!\n\n${command.example}`, message);
        }
    },
};
