import type { ConfigCommands } from "../../types/structure/commands";
import { MessageContextBuilder } from "../../modules/handlers/message/message-context.builder";

export default {
    name: "afk",
    alias: ["awayfromkeyboard"],
    category: "group",
    usage: "[reason]",
    description: "AFK from group",
    isGroup: true,
    async run({ Chisato, from, query, message, Database, sender }) {
        const user = await Database.User.get(sender);

        if (user?.afk?.status) {
            return Chisato.sendText(from, `You are already AFK!`, message);
        }

        await Database.User.update(sender, {
            afk: {
                status: true,
                reason: query || "No Reason",
                since: Date.now(),
            },
        });
        MessageContextBuilder.invalidateUser(sender);

        return Chisato.sendText(
            from,
            `✅ You are now AFK!\nReason: ${query || "No Reason"}`,
            message
        );
    },
} satisfies ConfigCommands;