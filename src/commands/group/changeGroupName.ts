import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "groupname",
    alias: ["gcname", "gtitle", "gname"],
    usage: "<text>",
    category: "group",
    description: "Change Group Name",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `• /groupname Halo This is Group Name`,
    async run({ Chisato, query, from, message }) {
        await Chisato.groupUpdateSubject(from, query)
            .then(() => Chisato.sendText(from, `Successfully changed the group name to ${query}`, message))
            .catch(() => Chisato.sendText(from, `Failed to change group name`, message));
    },
};
