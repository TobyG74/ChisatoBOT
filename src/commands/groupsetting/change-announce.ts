import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "announce",
    alias: ["groupannounce", "changeannounce"],
    category: "group setting",
    description: "Toggle group announcement mode (only admins can send messages)",
    usage: "[on/off]",
    example: `*「 ANNOUNCEMENT MODE 」*

🔒 Toggle group announcement mode

📝 *Description:*
When enabled, only admins can send messages to the group.

💡 *Usage:*
{prefix}{command.name} on
{prefix}{command.name} off
{prefix}{command.name}

🔒 *Note:* Bot must be admin to change this setting.`,
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, args, message, groupMetadata, prefix }) {
        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (groupMetadata?.announce) {
                return Chisato.sendText(
                    from,
                    "❌ Announcement mode is already *enabled*!",
                    message
                );
            }

            await Chisato.groupSettingUpdate(from, "announcement");

            let text = `*「 ANNOUNCEMENT MODE ENABLED 」*\n\n`;
            text += `✅ Announcement mode has been *enabled*!\n\n`;
            text += `🔒 Only admins can now send messages to this group.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!groupMetadata?.announce) {
                return Chisato.sendText(
                    from,
                    "❌ Announcement mode is already *disabled*!",
                    message
                );
            }

            await Chisato.groupSettingUpdate(from, "not_announcement");

            let text = `*「 ANNOUNCEMENT MODE DISABLED 」*\n\n`;
            text += `✅ Announcement mode has been *disabled*!\n\n`;
            text += `📝 All members can now send messages to this group.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}announce on\n`;
            text += `• ${prefix}announce off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
