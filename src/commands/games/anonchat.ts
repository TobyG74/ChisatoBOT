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
    description: "Start an anonymous chat session and find a stranger to talk to",
    isPrivate: true,
    async run({ Chisato, from, sender, message }) {
        if (isInSession(sender)) {
            return Chisato.sendText(
                from,
                "🔒 *You are already connected with a stranger!*\n\n" +
                    "• */acstop* = end session\n" +
                    "• */acnext* = find a new stranger",
                message
            );
        }

        if (isInQueue(sender)) {
            return Chisato.sendText(
                from,
                "⏳ *You are currently in the search queue...*\n\n" +
                    "• */acstop* = cancel",
                message
            );
        }

        joinQueue(sender);
        const matched = tryMatch();

        if (matched) {
            const [jidA, jidB] = matched;
            const connectedMsg =
                "✅ *Stranger found!*\n\n" +
                "You are now connected with a new person anonymously.\n" +
                "Text, images, videos, audio, and stickers will be forwarded.\n\n" +
                "• */acstop* = end session\n" +
                "• */acnext* = find a new stranger\n\n" +
                "💬 Say hi! 👋";
            await Chisato.sendText(jidA, connectedMsg);
            await Chisato.sendText(jidB, connectedMsg);
        } else {
            await Chisato.sendText(
                from,
                "🔍 *Searching for a stranger...*\n\n" +
                    "Please wait, we are finding a chat partner for you.\n\n" +
                    "• */acstop* = cancel",
                message
            );
        }
    },
} satisfies ConfigCommands;
