import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "antidelete",
    alias: ["antidel", "antihapus"],
    category: "group setting",
    description: "Resend messages that members delete-for-everyone",
    usage: "[on/off]",
    example: `*「 ANTI-DELETE 」*

🗑 Auto-resend deleted messages

📝 *Description:*
When a member deletes a message for everyone, the bot will repost the original
content (text, image, video, sticker, audio, document, etc.) back to the group
with an attribution header showing who sent it and who deleted it.

💡 *Usage:*
{prefix}{command.name} on
{prefix}{command.name} off

⚠️ *Notes:*
• Group-only feature.
• Only catches messages received while the bot is online and online for ≤ 30 min.
• Bot's own messages are skipped.`,
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, args, message, Database, prefix }) {
        const groupSetting = await Database.Group.getSettings(from);
        const action = (args[0] ?? "").toLowerCase();

        if (["on", "enable", "true", "1"].includes(action)) {
            if (groupSetting?.antidelete) {
                return Chisato.sendText(from, "❌ Anti-delete sudah *aktif*!", message);
            }
            await Database.Group.updateSettings(from, { antidelete: true });
            return Chisato.sendText(
                from,
                `*「 ANTI-DELETE ENABLED 」*\n\n✅ Anti-delete telah *diaktifkan* untuk grup ini.\n📝 Bot akan mengirim ulang pesan yang dihapus member.`,
                message
            );
        }

        if (["off", "disable", "false", "0"].includes(action)) {
            if (!groupSetting?.antidelete) {
                return Chisato.sendText(from, "❌ Anti-delete sudah *nonaktif*!", message);
            }
            await Database.Group.updateSettings(from, { antidelete: false });
            return Chisato.sendText(
                from,
                `*「 ANTI-DELETE DISABLED 」*\n\n✅ Anti-delete telah *dinonaktifkan*.`,
                message
            );
        }

        let text = `*「 INVALID ARGUMENT 」*\n\n`;
        text += `❌ Gunakan *on* atau *off* sebagai argumen.\n\n`;
        text += `💡 *Usage:*\n`;
        text += `• ${prefix}antidelete on\n`;
        text += `• ${prefix}antidelete off`;
        return Chisato.sendText(from, text, message);
    },
} satisfies ConfigCommands;
