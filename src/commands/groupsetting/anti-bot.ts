import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "antibot",
    alias: ["autokickbot"],
    category: "group setting",
    description: "Automatically kick bot accounts from group",
    usage: "[on/off]",
    example: `*「 ANTI-BOT 」*

🤖 Automatically kick bot accounts

📝 *Description:*
Anti-bot feature will automatically kick bot accounts that join the group.

💡 *Usage:*
{prefix}{command.name} on
{prefix}{command.name} off

⚠️ *Note:* Bot must be admin to kick other bots.`,
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, args, message, Database, prefix }) {
        const groupSetting = await Database.Group.getSettings(from);

        const action = args[0].toLowerCase();

        if (action === "on" || action === "enable" || action === "true" || action === "1") {
            if (groupSetting?.antibot) {
                return Chisato.sendText(
                    from,
                    "❌ Anti-bot is already *enabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { antibot: true });

            let text = `*「 ANTI-BOT ENABLED 」*\n\n`;
            text += `✅ Anti-bot feature has been *enabled*!\n\n`;
            text += `🤖 Bot accounts will be automatically kicked when they join.`;

            return Chisato.sendText(from, text, message);
        } else if (action === "off" || action === "disable" || action === "false" || action === "0") {
            if (!groupSetting?.antibot) {
                return Chisato.sendText(
                    from,
                    "❌ Anti-bot is already *disabled*!",
                    message
                );
            }

            await Database.Group.updateSettings(from, { antibot: false });

            let text = `*「 ANTI-BOT DISABLED 」*\n\n`;
            text += `✅ Anti-bot feature has been *disabled*!\n\n`;
            text += `📝 Bot accounts can now join the group.`;

            return Chisato.sendText(from, text, message);
        } else {
            let text = `*「 INVALID ARGUMENT 」*\n\n`;
            text += `❌ Please use *on* or *off* as argument.\n\n`;
            text += `💡 *Usage:*\n`;
            text += `• ${prefix}antibot on\n`;
            text += `• ${prefix}antibot off`;

            return Chisato.sendText(from, text, message);
        }
    },
} satisfies ConfigCommands;
