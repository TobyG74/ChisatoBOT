import type { ConfigCommands } from "../../types/structure/commands";
import { configService } from "../../core/config/config.service";

export default {
    name: "autocorrect",
    alias: ["ac", "autofix"],
    category: "owner",
    description: "Toggle auto-correct feature for command suggestions",
    usage: "[on/off]",
    example: `*「 AUTO-CORRECT 」*

✅ Toggle auto-correct feature

📝 *Description:*
Auto-correct feature will suggest similar commands when users type an incorrect command name.

💡 *Usage:*
{prefix}{command.name} on
{prefix}{command.name} off

🎯 *Example:* If user types ".mnu" (typo), bot will suggest ".menu"`,
    isOwner: true,
    async run({ Chisato, message, args, from }) {
        const config = configService.getConfig();

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (config.settings.autoCorrect) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-correct is already *enabled*!",
                    message
                );
            }

            configService.updateSettings({ autoCorrect: true });

            let text = `*「 AUTO-CORRECT ENABLED 」*\n\n`;
            text += `✅ Auto-correct feature has been *enabled*!\n\n`;
            text += `📝 Users will now receive command suggestions when they make typos.\n\n`;
            text += `💡 Example:\n`;
            text += `User: "${config.prefix}mnu"\n`;
            text += `Bot: "Did you mean: ${config.prefix}menu?"`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!config.settings.autoCorrect) {
                return Chisato.sendText(
                    from,
                    "❌ Auto-correct is already *disabled*!",
                    message
                );
            }

            configService.updateSettings({ autoCorrect: false });

            let text = `*「 AUTO-CORRECT DISABLED 」*\n\n`;
            text += `✅ Auto-correct feature has been *disabled*!\n\n`;
            text += `📝 Users will no longer receive command suggestions for typos.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${config.prefix}autocorrect on\n`;
            text += `• ${config.prefix}autocorrect off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
