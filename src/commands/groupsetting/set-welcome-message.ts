import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "setwelcome",
    alias: ["setwelcomemsg", "setwelcomemessage"],
    category: "group setting",
    description: "Set custom welcome message for new members",
    usage: "[message]",
    example: `*「 SET WELCOME MESSAGE 」*

✍️ Set custom welcome message for new members

📝 *Available Variables:*
• @user - Tag member baru
• @group - Nama grup
• @ownergroup - Tag owner grup
• @mention - Tag member tertentu (contoh: @628131473923)

💡 *Usage:*
{prefix}{command.name} [message]
{prefix}{command.name} reset - Reset ke default

📋 *Example:*
{prefix}{command.name} Halo @user, Selamat datang di @group! Sambutan dibuat oleh @ownergroup dan @628131473923

{prefix}{command.name} Selamat bergabung @user 👋

{prefix}{command.name} reset

📝 *Note:* 
• Welcome message harus sudah diaktifkan
• Gunakan "reset" untuk kembali ke default message`,
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, args, from, message, Database, prefix, command }) {
        const groupSetting = await Database.Group.getSettings(from);

        if (!groupSetting?.welcome) {
            return Chisato.sendText(
                from,
                `⚠️ *Welcome message is not enabled!*\n\n` +
                    `Please enable it first using:\n` +
                    `${prefix}memberwelcome on`,
                message
            );
        }

        const messageText = args.join(" ");

        if (messageText.toLowerCase() === "reset") {
            await Database.Group.updateSettings(from, { welcomeMessage: null });

            let text = `*「 WELCOME MESSAGE RESET 」*\n\n`;
            text += `✅ Welcome message has been reset to default!\n\n`;
            text += `📝 Bot will use the default welcome message.`;

            return Chisato.sendText(from, text, message);
        }

        await Database.Group.updateSettings(from, { welcomeMessage: messageText });

        let text = `*「 WELCOME MESSAGE SET 」*\n\n`;
        text += `✅ Custom welcome message has been set!\n\n`;
        text += `📝 *Your Message:*\n${messageText}\n\n`;
        text += `👋 This message will be sent to new members.\n\n`;
        text += `💡 *Tip:* Use ${prefix}${command.name} reset to restore default message.`;

        return Chisato.sendText(from, text, message);
    },
} satisfies ConfigCommands;
