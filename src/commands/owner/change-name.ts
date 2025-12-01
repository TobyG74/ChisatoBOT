import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "setname",
    alias: ["changename"],
    usage: "[text]",
    category: "owner",
    description: "Change Bot Name",
    isOwner: true,
    example: `• {prefix}{command.name} Chisato`,
    async run({ Chisato, query, from, message }) {
        await Chisato.updateProfileName(query)
            .then(() => Chisato.sendText(from, `Successfully changed bot name to ${query}`, message))
            .catch(() => Chisato.sendText(from, `Failed to change bot name`, message));
    },
} satisfies ConfigCommands;