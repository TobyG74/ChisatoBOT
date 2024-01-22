import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "grouplink",
    alias: ["linkgroup", "gclink", "glink"],
    category: "group",
    description: "Get Group Link",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, message }) {
        await Chisato.groupInviteCode(from)
            .then((result) =>
                Chisato.sendText(from, `*「 GROUP URL 」*\n\n• Url : https://chat.whatsapp.com/${result}`, message)
            )
            .catch(() => Chisato.sendText(from, "Failed to get group link", message));
    },
};
