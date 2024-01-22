import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "tagall",
    alias: ["mentionall"],
    usage: "<text>",
    category: "group",
    description: "Tag / Mention All Group Members.",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, args, from }) {
        try {
            const groupMetadata = await Chisato.groupMetadata(from);
            const groupParticipants = groupMetadata.participants ? groupMetadata.participants : [];
            let text = args.length > 0 ? args.join(" ") : "";
            let str = `*「 MENTION ALL 」*\n\n${text ? "• " + text + "\n\n" : " "}`;
            for (let i of groupParticipants) {
                str += `• @${i.id.split("@")[0]}\n`;
            }
            await Chisato.sendText(from, str, null, {
                mentions: groupParticipants.map((e) => e.id),
            });
        } catch (e) {
            Chisato.log("error", e);
        }
    },
};
