import type { ConfigCommands } from "../../types/structure/commands";
import {
    joinQueue,
    tryMatch,
    isInSession,
    isInQueue,
} from "../../libs/anonymous-chat";

export default {
    name: "achat",
    alias: ["anonc", "anonymouschat", "caristanger"],
    category: "games",
    description: "Mulai anonymous chat dengan stranger secara acak",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        if (isInSession(sender)) {
            return Chisato.sendText(
                from,
                "🔒 *Kamu sudah terhubung dengan stranger!*\n\n" +
                    "• */acstop* = akhiri sesi\n" +
                    "• *!acnext* = cari stranger baru",
                message
            );
        }

        if (isInQueue(sender)) {
            return Chisato.sendText(
                from,
                "⏳ *Kamu sedang dalam antrian pencarian...*\n\n" +
                    "• */acstop* = batal",
                message
            );
        }

        joinQueue(sender);
        const matched = tryMatch();

        if (matched) {
            const [jidA, jidB] = matched;
            const connectedMsg =
                "✅ *Stranger ditemukan!*\n\n" +
                "Kamu sekarang terhubung secara anonim dengan seseorang.\n" +
                "Teks, gambar, video, audio, dan stiker akan diteruskan.\n\n" +
                "• */acstop* = akhiri sesi\n" +
                "• *!acnext* = cari stranger baru\n\n" +
                "💬 Say hi! 👋";
            await Chisato.sendText(jidA, connectedMsg);
            await Chisato.sendText(jidB, connectedMsg);
        } else {
            await Chisato.sendText(
                from,
                "🔍 *Mencari stranger...*\n\n" +
                    "Mohon tunggu, sedang mencarikan teman ngobrol untukmu.\n\n" +
                    "• */acstop* = batal",
                message
            );
        }
    },
} satisfies ConfigCommands;
