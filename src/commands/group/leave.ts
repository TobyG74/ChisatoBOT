import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "leave",
    alias: ["keluar", "out", "bye"],
    usage: "<text>",
    category: "group",
    description: "Leave from group",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message }) {
        await Chisato.sendText(from, "Bye All ~", message);
        Chisato.groupLeave(from);
    },
};
