import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "setbio",
    alias: ["setstatus", "changebio"],
    usage: "<text>",
    category: "owner",
    description: "Change Bot Status",
    isOwner: true,
    example: `• /setbio Halo This is Bot Status`,
    async run({ Chisato, query, from, message }) {
        await Chisato.updateProfileStatus(query)
            .then(() => Chisato.sendText(from, `Successfully changed bot status to ${query}`, message))
            .catch(() => Chisato.sendText(from, `Failed to change bot status`, message));
    },
};
