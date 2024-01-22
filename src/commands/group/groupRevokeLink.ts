import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "grouprevoke",
    alias: ["grevoke", "greset"],
    category: "group",
    description: "Get Group Revoke Link",
    isGroup: true,
    isGroupAdmin: true,
    isBotAdmin: true,
    async run({ Chisato, from, message }) {
        await Chisato.groupRevokeInvite(from)
            .then(() => Chisato.sendText(from, `Group link has been reset!`, message))
            .catch(() => Chisato.sendText(from, "Failed to get group revoke link", message));
    },
};
