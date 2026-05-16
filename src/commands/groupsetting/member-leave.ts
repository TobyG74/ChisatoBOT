import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "memberleave",
    alias: ["mleft", "goodbye"],
    category: "group setting",
    description: "Send goodbye message when members leave group",
    usage: "[on/off]",
    example: `*「 LEAVE MESSAGE 」*

👋 Send goodbye message when members leave

📝 *Description:*
Leave message feature will send goodbye message when members leave the group.

💡 *Set leave message:*
{prefix}setleave [message] 

💡 *Usage:*
{prefix}{command.name} on
{prefix}{command.name} off

👋 *Note:* Bot must be admin to detect member removals.`,
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, args, from, message, Database, isBotAdmin, prefix }) {
        if (!isBotAdmin) {
            return Chisato.sendText(
                from,
                `⚠️ Bot must be a group admin for this feature to work!\n\n📝 Please promote bot to admin first.`,
                message
            );
        }

        const groupSetting = await Database.Group.getSettings(from);

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (groupSetting?.leave) {
                return Chisato.sendText(
                    from,
                    "❌ Leave message is already *enabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { leave: true });

            let text = `*「 LEAVE MESSAGE ENABLED 」*\n\n`;
            text += `✅ Leave message has been *enabled*!\n\n`;
            text += `👋 Bot will now send goodbye message when members leave.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!groupSetting?.leave) {
                return Chisato.sendText(
                    from,
                    "❌ Leave message is already *disabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { leave: false });

            let text = `*「 LEAVE MESSAGE DISABLED 」*\n\n`;
            text += `✅ Leave message has been *disabled*!\n\n`;
            text += `📝 Bot will no longer send goodbye messages.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}memberleave on\n`;
            text += `• ${prefix}memberleave off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
