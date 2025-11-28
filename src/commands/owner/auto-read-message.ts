import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "autoreadmessage",
    alias: ["autoreadmsg", "armsg"],
    category: "owner",
    description: "Toggle auto-read message feature",
    usage: "<on/off>",
    example: ".autoreadmessage on\n.autoreadmessage off\n.autoreadmessage",
    isOwner: true,
    async run({ Chisato, message, args, from }) {
        const config = configService.getConfig();

        if (args.length === 0) {
            const status = config.settings.autoReadMessage ? "ON" : "OFF";
            const emoji = config.settings.autoReadMessage ? "✅" : "❌";
            
            let text = `*「 AUTO-READ MESSAGE STATUS 」*\n\n`;
            text += `${emoji} Auto-Read Message: *${status}*\n\n`;
            text += `📝 *Description:*\n`;
            text += `Auto-read message feature will automatically mark all incoming messages as read.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${config.prefix}autoreadmessage on\n`;
            text += `• ${config.prefix}autoreadmessage off\n\n`;
            text += `🎯 *Note:*\n`;
            text += `When enabled, all messages will be automatically marked as read without manual action.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (config.settings.autoReadMessage) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-read message is already *enabled*!",
                    message
                );
            }

            configService.updateSettings({ autoReadMessage: true });

            let text = `*「 AUTO-READ MESSAGE ENABLED 」*\n\n`;
            text += `✅ Auto-read message feature has been *enabled*!\n\n`;
            text += `📝 All incoming messages will now be automatically marked as read.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!config.settings.autoReadMessage) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-read message is already *disabled*!",
                    message
                );
            }

            configService.updateSettings({ autoReadMessage: false });

            let text = `*「 AUTO-READ MESSAGE DISABLED 」*\n\n`;
            text += `✅ Auto-read message feature has been *disabled*!\n\n`;
            text += `📝 Messages will no longer be automatically marked as read.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${config.prefix}autoreadmessage on\n`;
            text += `• ${config.prefix}autoreadmessage off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
