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
    description: "End an anonymous chat session",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        if (isInSession(sender)) {
            const partner = endSession(sender);

            await Chisato.sendText(
                from,
                "👋 *Session ended.*\n\nYou have left the chat.\nType */achat* to find a new stranger.",
                message
            );

            if (partner) {
                await Chisato.sendText(
                    partner,
                    "👋 *Stranger has left the chat.*\n\nThe session has ended.\nType */achat* to find a new stranger."
                );
            }
            return;
        }

        if (isInQueue(sender)) {
            leaveQueue(sender);
            return Chisato.sendText(
                from,
                "✅ You have left the search queue.",
                message
            );
        }

        return Chisato.sendText(
            from,
            "ℹ️ You are not currently in an anonymous chat session.\nType */achat* to start.",
            message
        );
    },
} satisfies ConfigCommands;
