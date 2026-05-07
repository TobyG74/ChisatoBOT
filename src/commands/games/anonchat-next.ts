import type { ConfigCommands } from "../../types/structure/commands";
import {
    endSession,
    leaveQueue,
    joinQueue,
    tryMatch,
    isInSession,
    isInQueue,
} from "../../libs/anonymous-chat";

export default {
    name: "acnext",
    alias: ["nextstanger", "anonext"],
    category: "games",
    description: "Cari stranger baru dalam anonymous chat",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        // End current session and notify partner
        if (isInSession(sender)) {
            const partner = endSession(sender);
            if (partner) {
                await Chisato.sendText(
                    partner,
                    "👋 *Stranger meninggalkan chat.*\n\nSesi telah diakhiri.\nKetik *!achat* untuk mencari stranger baru."
                );
            }
        } else if (isInQueue(sender)) {
            leaveQueue(sender);
        }

        // Re-join queue for a new match
        joinQueue(sender);
        const matched = tryMatch();

        if (matched) {
            const [jidA, jidB] = matched;
            const connectedMsg =
                "✅ *Stranger baru ditemukan!*\n\n" +
                "Kamu sekarang terhubung dengan orang baru secara anonim.\n\n" +
                "• */acstop* = akhiri sesi\n" +
                "• *!acnext* = cari stranger baru\n\n" +
                "💬 Say hi! 👋";
            await Chisato.sendText(jidA, connectedMsg);
            await Chisato.sendText(jidB, connectedMsg);
        } else {
            await Chisato.sendText(
                from,
                "🔍 *Mencari stranger baru...*\n\n" +
                    "Mohon tunggu, sedang mencarikan teman ngobrol untukmu.\n\n" +
                    "• */acstop* = batal",
                message
            );
        }
    },
} satisfies ConfigCommands;
