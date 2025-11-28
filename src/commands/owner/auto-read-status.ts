import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "autoreadstatus",
    alias: ["autoreadsw", "arsw"],
    category: "owner",
    description: "Toggle auto-read status/story feature",
    usage: "<on/off>",
    example: ".autoreadstatus on\n.autoreadstatus off\n.autoreadstatus",
    isOwner: true,
    async run({ Chisato, message, args, from }) {
        const config = configService.getConfig();

        if (args.length === 0) {
            const status = config.settings.autoReadStatus ? "ON" : "OFF";
            const emoji = config.settings.autoReadStatus ? "✅" : "❌";
            
            let text = `*「 AUTO-READ STATUS 」*\n\n`;
            text += `${emoji} Auto-Read Status: *${status}*\n\n`;
            text += `📝 *Description:*\n`;
            text += `Auto-read status feature will automatically view all WhatsApp status/stories.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${config.prefix}autoreadstatus on\n`;
            text += `• ${config.prefix}autoreadstatus off\n\n`;
            text += `🎯 *Note:*\n`;
            text += `When enabled, bot will automatically view all status updates from contacts.`;

            return Chisato.sendText(from, text, message);
        }

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (config.settings.autoReadStatus) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-read status is already *enabled*!",
                    message
                );
            }

            configService.updateSettings({ autoReadStatus: true });

            let text = `*「 AUTO-READ STATUS ENABLED 」*\n\n`;
            text += `✅ Auto-read status feature has been *enabled*!\n\n`;
            text += `📝 Bot will now automatically view all WhatsApp status/stories.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!config.settings.autoReadStatus) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-read status is already *disabled*!",
                    message
                );
            }

            configService.updateSettings({ autoReadStatus: false });

            let text = `*「 AUTO-READ STATUS DISABLED 」*\n\n`;
            text += `✅ Auto-read status feature has been *disabled*!\n\n`;
            text += `📝 Bot will no longer automatically view status updates.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${config.prefix}autoreadstatus on\n`;
            text += `• ${config.prefix}autoreadstatus off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
