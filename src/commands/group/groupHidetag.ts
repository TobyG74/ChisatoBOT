import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "hidetag",
    alias: ["htag"],
    usage: "<text>",
    category: "group",
    description: "Tag / Mention All Group Members.",
    isGroup: true,
    isGroupAdmin: true,
    example: `/hidetag Halo`,
    async run({ Chisato, args, from }) {
        try {
            const groupMetadata = await Chisato.groupMetadata(from);
            const groupParticipants = groupMetadata.participants ? groupMetadata.participants : [];
            const participants = [];
            const text = args.length > 0 ? args.join(" ") : "@everyone";
            for (const i of groupParticipants) {
                participants.push(i.id);
            }
            await Chisato.sendText(from, text, null, { mentions: participants });
        } catch (e) {
            Chisato.log("error", e);
        }
    },
};
