import type { ConfigCommands } from "../../types/structure/commands";
import {
    endSession,
    leaveQueue,
    isInSession,
    isInQueue,
} from "../../libs/anonymous-chat";

export default {
    name: "acstop",
    alias: ["stopanonc", "stopanon"],
    category: "games",
    description: "Akhiri sesi anonymous chat",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        if (isInSession(sender)) {
            const partner = endSession(sender);

            await Chisato.sendText(
                from,
                "👋 *Sesi diakhiri.*\n\nKamu telah meninggalkan chat.\nKetik *!achat* untuk mencari stranger baru.",
                message
            );

            if (partner) {
                await Chisato.sendText(
                    partner,
                    "👋 *Stranger meninggalkan chat.*\n\nSesi telah diakhiri.\nKetik *!achat* untuk mencari stranger baru."
                );
            }
            return;
        }

        if (isInQueue(sender)) {
            leaveQueue(sender);
            return Chisato.sendText(
                from,
                "✅ Kamu keluar dari antrian pencarian.",
                message
            );
        }

        return Chisato.sendText(
            from,
            "ℹ️ Kamu tidak sedang dalam sesi anonymous chat.\nKetik *!achat* untuk memulai.",
            message
        );
    },
} satisfies ConfigCommands;
