import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "groupname",
    alias: ["gcname", "gtitle", "gname"],
    usage: "[text]",
    category: "group",
    description: "Change Group Name",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `• {prefix}{command.name} Halo This is Group Name`,
    async run({ Chisato, query, from, message }) {
        await Chisato.groupUpdateSubject(from, query)
            .then(() => Chisato.sendText(from, `Successfully changed the group name to ${query}`, message))
            .catch(() => Chisato.sendText(from, `Failed to change group name`, message));
    },
} satisfies ConfigCommands;