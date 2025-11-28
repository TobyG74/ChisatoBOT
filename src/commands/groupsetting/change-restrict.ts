import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "restrict",
    alias: ["grouprestrict", "changerestrict", "lock"],
    category: "group setting",
    description: "Lock/unlock group settings (only admins can edit group info)",
    usage: "<on/off>",
    example: ".restrict on\n.restrict off\n.restrict",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, args, message, Database, prefix }) {
        const groupSetting = await Database.Group.get(from);

        if (args.length === 0) {
            const status = groupSetting?.restrict ? "LOCKED" : "UNLOCKED";
            const emoji = groupSetting?.restrict ? "🔒" : "🔓";
            
            let text = `*「 GROUP RESTRICT STATUS 」*\n\n`;
            text += `${emoji} Group Settings: *${status}*\n\n`;
            text += `📝 *Description:*\n`;
            text += groupSetting?.restrict
                ? `Only admins can edit group info (name, icon, description).`
                : `All members can edit group info.`;
            text += `\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}restrict on\n`;
            text += `• ${prefix}restrict off\n\n`;
            text += `🔒 *Note:* Bot must be admin to change this setting.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1" || action === "lock") {
            if (groupSetting?.restrict) {
                return Chisato.sendText(
                    from,
                    "❌ Group settings are already *locked*!",
                    message
                );
            }

            await Chisato.groupSettingUpdate(from, "locked");
            await Database.Group.update(from, { restrict: true });

            let text = `*「 GROUP SETTINGS LOCKED 」*\n\n`;
            text += `✅ Group settings have been *locked*!\n\n`;
            text += `🔒 Only admins can now edit group info.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0" || action === "unlock") {
            if (!groupSetting?.restrict) {
                return Chisato.sendText(
                    from,
                    "❌ Group settings are already *unlocked*!",
                    message
                );
            }

            await Chisato.groupSettingUpdate(from, "unlocked");
            await Database.Group.update(from, { restrict: false });

            let text = `*「 GROUP SETTINGS UNLOCKED 」*\n\n`;
            text += `✅ Group settings have been *unlocked*!\n\n`;
            text += `🔓 All members can now edit group info.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}restrict on\n`;
            text += `• ${prefix}restrict off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
