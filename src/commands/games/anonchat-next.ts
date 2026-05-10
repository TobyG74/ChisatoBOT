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
    description: "Find a new stranger to chat with while keeping your anonymity",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        // End current session and notify partner
        if (isInSession(sender)) {
            const partner = endSession(sender);
            if (partner) {
                await Chisato.sendText(
                    partner,
                    "👋 *Stranger has left the chat.*\n\nThe session has ended.\nType */achat* to find a new stranger."
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
                "✅ *New stranger found!*\n\n" +
                "You are now connected with a new person anonymously.\n\n" +
                "• */acstop* = end session\n" +
                "• */acnext* = find a new stranger\n\n" +
                "💬 Say hi! 👋";
            await Chisato.sendText(jidA, connectedMsg);
            await Chisato.sendText(jidB, connectedMsg);
        } else {
            await Chisato.sendText(
                from,
                "🔍 *Searching for a new stranger...*\n\n" +
                    "Please wait, we are finding a chat partner for you.\n\n" +
                    "• */acstop* = cancel search\n",
                message
            );
        }
    },
} satisfies ConfigCommands;
