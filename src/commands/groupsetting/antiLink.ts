import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "antilink",
    alias: ["autourl"],
    usage: "<option> <mode>",
    category: "group setting",
    description: "Anti Link Protect",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `
*Option :* add | del | on | off 

*List Link :*
• youtube, facebook, instagram, whatsapp, twitter, tiktok, all

*Add Link to List*
• /antilink add youtube

*Detele Link from List*
• /antilink del youtube

*Turn on*
• /antilink on

*Turn off*
• /antilink off

*Mode :* delete | kick

*Set Delete Mode*
• /antilink mode delete

*Set Kick Mode*
• /antilink mode kick

*Reset List Link*
• /antilink reset`,
    async run({ Chisato, from, args, message, Database, command }) {
        const groupSetting = await Database.GroupSetting.get(from);
        const listLink = ["youtube", "facebook", "instagram", "whatsapp", "twitter", "tiktok", "all"];
        switch (args[0]) {
            case "add":
                if (groupSetting?.antilink.list.includes(args[1]))
                    return Chisato.sendText(from, `Link ${args[1]} already in list!`, message);
                if (!listLink.includes(args[1]))
                    return Chisato.sendText(
                        from,
                        `Link ${args[1]} not in list!\n\nList :\n• ${listLink.join(", ")}`,
                        message
                    );
                if (args[1] === "all") {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: true,
                            mode: groupSetting.antilink.mode,
                            list: listLink,
                        },
                    });
                } else {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: true,
                            mode: groupSetting.antilink.mode,
                            list: [...groupSetting.antilink.list, args[1]],
                        },
                    });
                }
                await Chisato.sendText(from, `Link ${args[1]} has been added to list!`, message);
                break;
            case "del":
                if (!groupSetting?.antilink.list.includes(args[1]))
                    return Chisato.sendText(from, `Link ${args[1]} not in list!`, message);
                if (!listLink.includes(args[1]))
                    return Chisato.sendText(
                        from,
                        `Link ${args[1]} not in list!\n\nList :\n• ${listLink.join(", ")}`,
                        message
                    );
                if (args[1] === "all") {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: false,
                            mode: groupSetting.antilink.mode,
                            list: [],
                        },
                    });
                } else {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: true,
                            mode: groupSetting.antilink.mode,
                            list: groupSetting.antilink.list,
                        },
                    });
                }
                await Chisato.sendText(from, `Link ${args[1]} has been deleted from list!`, message);
                break;
            case "on":
                if (groupSetting?.antilink.status)
                    return Chisato.sendText(from, `Anti Link is already active!`, message);
                await Database.GroupSetting.update(from, {
                    antilink: {
                        status: true,
                        mode: groupSetting.antilink.mode,
                        list: groupSetting.antilink.list,
                    },
                });
                await Chisato.sendText(from, `Anti Link has been activated!`, message);
                break;
            case "off":
                if (!groupSetting?.antilink.status)
                    return Chisato.sendText(from, `Anti Link is already disabled!`, message);
                await Database.GroupSetting.update(from, {
                    antilink: {
                        status: false,
                        mode: groupSetting.antilink.mode,
                        list: groupSetting.antilink.list,
                    },
                });
                await Chisato.sendText(from, `Anti Link has been disabled!`, message);
                break;
            case "mode":
                if (args[1] === "delete") {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: groupSetting.antilink.status,
                            mode: "delete",
                            list: groupSetting.antilink.list,
                        },
                    });
                    await Chisato.sendText(from, `Anti Link mode has been set to delete!`, message);
                } else if (args[1] === "kick") {
                    await Database.GroupSetting.update(from, {
                        antilink: {
                            status: groupSetting.antilink.status,
                            mode: "kick",
                            list: groupSetting.antilink.list,
                        },
                    });
                    await Chisato.sendText(from, `Anti Link mode has been set to kick!`, message);
                } else {
                    await Chisato.sendText(from, `Mode must be delete or kick!`, message);
                }
                break;
            case "reset":
                await Database.GroupSetting.update(from, {
                    antilink: {
                        status: groupSetting.antilink.status,
                        mode: groupSetting.antilink.mode,
                        list: [],
                    },
                });
                await Chisato.sendText(from, `Link list has been reset!`, message);
                break;
            default:
                await Chisato.sendText(from, `Example :\n${command.example}`, message);
        }
    },
};
