import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "notify",
    alias: ["gnotify", "groupnotify"],
    usage: "<on|off>",
    category: "group setting",
    description: "Group Notifications.",
    isGroup: true,
    isGroupAdmin: true,
    example: `
*Turn On*
• /leave on

*Turn Off*
• /leave off`,
    async run({ Chisato, from, args, message, Database, isBotAdmin }) {
        if (!isBotAdmin)
            return Chisato.sendText(
                from,
                "Hello, Currently Chisato is not a group admin. Please make the group admin so that the notify command works!",
                message
            );
        const groupSetting = await Database.GroupSetting.get(from);
        if (/(on|enable|aktif)/.test(args[0])) {
            if (groupSetting?.notify) return Chisato.sendText(from, `Group Notifications is already active!`, message);
            await Database.GroupSetting.update(from, { notify: true });
            return Chisato.sendText(from, `Group Notifications has been activated!`, message);
        } else if (/(off|disable|nonaktif)/.test(args[0])) {
            if (!groupSetting?.notify)
                return Chisato.sendText(from, `Group Notifications is already disabled!`, message);
            await Database.GroupSetting.update(from, { notify: false });
            return Chisato.sendText(from, `Group Notifications has been disabled!`, message);
        }
    },
};
