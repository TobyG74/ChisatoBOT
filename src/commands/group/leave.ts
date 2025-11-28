import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "leave",
    alias: ["keluar", "out", "bye"],
    usage: "<text>",
    category: "group",
    description: "Leave from group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message, Database }) {
        await Chisato.sendText(from, "Bye All ~", message);
        Chisato.groupLeave(from).then(() => {
            Database.Group.delete(from);
        });
    },
} satisfies ConfigCommands;