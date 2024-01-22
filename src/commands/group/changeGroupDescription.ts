import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "groupdesc",
    alias: ["gcbio", "gdesc", "gbio"],
    usage: "<text>",
    category: "group",
    description: "Change Group Description",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    example: `• /groupdesc Halo This is Group Description`,
    async run({ Chisato, query, from, message }) {
        await Chisato.groupUpdateDescription(from, query)
            .then(() => Chisato.sendText(from, `Successfully changed the group description to ${query}`, message))
            .catch(() => Chisato.sendText(from, `Failed to change group description`, message));
    },
};
