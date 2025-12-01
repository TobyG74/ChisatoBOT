import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "anticall",
    alias: ["antitelpon", "antitlp"],
    category: "owner",
    description: "Configure anti-call feature (reject/block incoming calls)",
    usage: "[type]",
    example: `*「 ANTI-CALL 」*

📞 Configure anti-call feature

📝 *Description:*
Anti-call feature helps manage incoming calls automatically.

🎯 *Available Modes:*
• *REJECT* - Automatically reject incoming calls
• *BLOCK* - Reject and block the caller
• *OFF* - Allow all calls (disabled)

💡 *Usage:*
{prefix}{command.name} reject
{prefix}{command.name} block
{prefix}{command.name} off`,
    isOwner: true,
    async run({ Chisato, message, args, from }) {
        const config = configService.getConfig();

        const type = args[0].toLowerCase();

        switch (type) {
            case "reject":
                if (config.call.status === "reject") {
                    return Chisato.sendText(
                        from,
                        "❌ Anti-call is already set to *REJECT* mode!",
                        message
                    );
                }

                configService.updateConfig({ 
                    call: { status: "reject" } 
                });

                let rejectText = `*「 ANTI-CALL: REJECT MODE 」*\n\n`;
                rejectText += `✅ Anti-call has been set to *REJECT* mode!\n\n`;
                rejectText += `📝 Bot will automatically reject all incoming calls without blocking the caller.`;

                return Chisato.sendText(from, rejectText, message);

            case "block":
                if (config.call.status === "block") {
                    return Chisato.sendText(
                        from,
                        "❌ Anti-call is already set to *BLOCK* mode!",
                        message
                    );
                }

                configService.updateConfig({ 
                    call: { status: "block" } 
                });

                let blockText = `*「 ANTI-CALL: BLOCK MODE 」*\n\n`;
                blockText += `✅ Anti-call has been set to *BLOCK* mode!\n\n`;
                blockText += `📝 Bot will automatically reject and block all incoming calls.\n\n`;
                blockText += `⚠️ *Warning:* Callers will be permanently blocked!`;

                return Chisato.sendText(from, blockText, message);

            case "off":
            case "disable":
                if (config.call.status === "off") {
                    return Chisato.sendText(
                        from,
                        "❌ Anti-call is already *disabled*!",
                        message
                    );
                }

                configService.updateConfig({ 
                    call: { status: "off" } 
                });

                let offText = `*「 ANTI-CALL DISABLED 」*\n\n`;
                offText += `✅ Anti-call feature has been *disabled*!\n\n`;
                offText += `📝 Bot will now allow all incoming calls.`;

                return Chisato.sendText(from, offText, message);

            default:
                let errorText = `*「 INVALID MODE 」*\n\n`;
                errorText += `❌ Invalid anti-call mode: *${type}*\n\n`;
                errorText += `💡 *Available Modes:*\n`;
                errorText += `• ${config.prefix}anticall reject\n`;
                errorText += `• ${config.prefix}anticall block\n`;
                errorText += `• ${config.prefix}anticall off`;

                return Chisato.sendText(from, errorText, message);
        }
    },
} satisfies ConfigCommands;
