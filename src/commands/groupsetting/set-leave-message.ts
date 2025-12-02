import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "setleave",
    alias: ["setleavemsg", "setleavemessage"],
    category: "group setting",
    description: "Set custom leave message for members who left",
    usage: "[message]",
    example: `*「 SET LEAVE MESSAGE 」*

✍️ Set custom leave message for members who left

📝 *Available Variables:*
• @user - Tag member yang keluar
• @group - Nama grup
• @ownergroup - Tag owner grup
• @mention - Tag member tertentu (contoh: @628131473923)

💡 *Usage:*
{prefix}{command.name} [message]
{prefix}{command.name} reset - Reset ke default

📋 *Example:*
{prefix}{command.name} Selamat tinggal @user 👋, Semoga sukses selalu!

{prefix}{command.name} @user telah keluar dari @group

{prefix}{command.name} reset

📝 *Note:* 
• Leave message harus sudah diaktifkan
• Gunakan "reset" untuk kembali ke default message`,
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, args, from, message, Database, prefix, command }) {
        const groupSetting = await Database.Group.getSettings(from);

        if (!groupSetting?.leave) {
            return Chisato.sendText(
                from,
                `⚠️ *Leave message is not enabled!*\n\n` +
                    `Please enable it first using:\n` +
                    `${prefix}memberleave on`,
                message
            );
        }
        
        const messageText = args.join(" ");

        if (messageText.toLowerCase() === "reset") {
            await Database.Group.updateSettings(from, { leaveMessage: null });

            let text = `*「 LEAVE MESSAGE RESET 」*\n\n`;
            text += `✅ Leave message has been reset to default!\n\n`;
            text += `📝 Bot will use the default leave message.`;

            return Chisato.sendText(from, text, message);
        }

        await Database.Group.updateSettings(from, { leaveMessage: messageText });

        let text = `*「 LEAVE MESSAGE SET 」*\n\n`;
        text += `✅ Custom leave message has been set!\n\n`;
        text += `📝 *Your Message:*\n${messageText}\n\n`;
        text += `👋 This message will be sent when members leave.\n\n`;
        text += `💡 *Tip:* Use ${prefix}${command.name} reset to restore default message.`;

        return Chisato.sendText(from, text, message);
    },
} satisfies ConfigCommands;
