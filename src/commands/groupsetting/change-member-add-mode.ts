import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "addmode",
    alias: ["addmember", "memberadd"],
    category: "group setting",
    description: "Control who can add members to group",
    usage: "<on/off>",
    example: ".addmode on\n.addmode off\n.addmode",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, args, message, Database, prefix }) {
        const groupSetting = await Database.Group.get(from);

        if (args.length === 0) {
            const mode = groupSetting?.memberAddMode ? "ALL MEMBERS" : "ADMINS ONLY";
            const emoji = groupSetting?.memberAddMode ? "👥" : "🔒";
            
            let text = `*「 ADD MEMBER MODE STATUS 」*\n\n`;
            text += `${emoji} Current Mode: *${mode}*\n\n`;
            text += `📝 *Description:*\n`;
            text += groupSetting?.memberAddMode
                ? `All members can add other people to this group.`
                : `Only admins can add other people to this group.`;
            text += `\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}addmode on\n`;
            text += `• ${prefix}addmode off\n\n`;
            text += `🔒 *Note:* Bot must be admin to change this setting.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1" || action === "all") {
            if (groupSetting?.memberAddMode) {
                return Chisato.sendText(
                    from,
                    "❌ Add member mode is already set to *All Members*!",
                    message
                );
            }

            await Chisato.groupMemberAddMode(from, "all_member_add");
            await Database.Group.update(from, { memberAddMode: true });

            let text = `*「 ADD MEMBER MODE: ALL 」*\n\n`;
            text += `✅ Add member mode has been set to *All Members*!\n\n`;
            text += `👥 All members can now add people to this group.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0" || action === "admin") {
            if (!groupSetting?.memberAddMode) {
                return Chisato.sendText(
                    from,
                    "❌ Add member mode is already set to *Admins Only*!",
                    message
                );
            }

            await Chisato.groupMemberAddMode(from, "admin_add");
            await Database.Group.update(from, { memberAddMode: false });

            let text = `*「 ADD MEMBER MODE: ADMIN 」*\n\n`;
            text += `✅ Add member mode has been set to *Admins Only*!\n\n`;
            text += `🔒 Only admins can now add people to this group.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}addmode on (all members)\n`;
            text += `• ${prefix}addmode off (admins only)`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
