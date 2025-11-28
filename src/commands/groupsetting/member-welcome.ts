import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "memberwelcome",
    alias: ["memberwc", "welcome"],
    category: "group setting",
    description: "Send welcome message when members join group",
    usage: "<on/off>",
    example: ".memberwelcome on\n.memberwelcome off\n.memberwelcome",
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

        if (args.length === 0) {
            const status = groupSetting?.welcome ? "ON" : "OFF";
            const emoji = groupSetting?.welcome ? "✅" : "❌";
            
            let text = `*「 WELCOME MESSAGE STATUS 」*\n\n`;
            text += `${emoji} Welcome Message: *${status}*\n\n`;
            text += `📝 *Description:*\n`;
            text += `Welcome message feature will greet new members when they join the group.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}memberwelcome on\n`;
            text += `• ${prefix}memberwelcome off\n\n`;
            text += `👋 *Note:* Bot must be admin to detect new members.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (groupSetting?.welcome) {
                return Chisato.sendText(
                    from,
                    "❌ Welcome message is already *enabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { welcome: true });

            let text = `*「 WELCOME MESSAGE ENABLED 」*\n\n`;
            text += `✅ Welcome message has been *enabled*!\n\n`;
            text += `👋 Bot will now greet new members when they join.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!groupSetting?.welcome) {
                return Chisato.sendText(
                    from,
                    "❌ Welcome message is already *disabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { welcome: false });

            let text = `*「 WELCOME MESSAGE DISABLED 」*\n\n`;
            text += `✅ Welcome message has been *disabled*!\n\n`;
            text += `📝 Bot will no longer greet new members.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}memberwelcome on\n`;
            text += `• ${prefix}memberwelcome off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
