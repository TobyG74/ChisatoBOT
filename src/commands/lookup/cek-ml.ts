import type { ConfigCommands } from "../../types/structure/commands";
import { checkMLPlayer } from "../../utils/scrapers/lookup";

export default {
    name: "cekml",
    alias: ["cekmlbb", "stalknl", "mlcheck", "mlbbcheck"],
    usage: "[userID] [serverID]",
    category: "lookup",
    description: "Cek informasi akun Mobile Legends berdasarkan User ID dan Server ID",
    cooldown: 5,
    limit: 1,
    example: `*「 CEK AKUN ML 」*

🔍 Cek informasi akun Mobile Legends!

📝 *Cara menggunakan:*
{prefix}{command.name} [userID] [serverID]

💡 *Contoh:*
• {prefix}{command.name} 12345678 1234
• {prefix}cekmlbb 12345678 1234`,
    async run({ Chisato, from, args, message, command }) {
        if (!args || args.length < 2) {
            return Chisato.sendText(
                from,
                `*「 CEK AKUN ML 」*\n\n❌ Format salah!\n\n📝 *Cara penggunaan:*\n${command.name} [userID] [serverID]\n\n💡 *Contoh:*\n.cekml 12345678 1234`,
                message
            );
        }

        const userID = args[0];
        const serverID = args[1];

        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const data = await checkMLPlayer(userID, serverID);

            if (data.success) {
                await Chisato.sendReaction(from, "✅", message.key);

                const caption =
                    `*「 MOBILE LEGENDS ACCOUNT 」*\n\n` +
                    `✅ *Data Ditemukan!*\n\n` +
                    `• *User ID:* ${userID}\n` +
                    `• *Server ID:* ${serverID}\n` +
                    `• *Username:* ${data.username}\n` +
                    `• *Region:* ${data.region} (${data.countryCode})`;

                return Chisato.sendText(from, caption, message);
            } else {
                await Chisato.sendReaction(from, "❌", message.key);

                const errMsg = (data as import("../../utils/scrapers/lookup").MLPlayerError).message;

                return Chisato.sendText(
                    from,
                    `*「 MOBILE LEGENDS ACCOUNT 」*\n\n` +
                        `❌ *Data Tidak Ditemukan!*\n\n` +
                        `• *User ID:* ${userID}\n` +
                        `• *Server ID:* ${serverID}\n` +
                        `• *Pesan:* ${errMsg}\n\n` +
                        `_Pastikan User ID dan Server ID sudah benar._`,
                    message
                );
            }
        } catch (err: unknown) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(
                command.name,
                err instanceof Error ? err.message : String(err)
            );
            return Chisato.sendText(
                from,
                `*「 MOBILE LEGENDS ACCOUNT 」*\n\n❌ Terjadi kesalahan saat mengambil data.\nCoba lagi beberapa saat kemudian.`,
                message
            );
        }
    },
} satisfies ConfigCommands;
