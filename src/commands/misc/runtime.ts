import type { ConfigCommands } from "../../types/structure/commands";
import { Formatters } from "../../utils/core";

export default {
    name: "runtime",
    alias: ["rtime", "uptime"],
    category: "misc",
    description: "See the running time of the bot",
    async run({ Chisato, from, message }) {
        const time = process.uptime();
        await Chisato.sendText(
            from,
            `This bot has been running for ${Formatters.runtime(time)}`,
            message
        );
    },
} satisfies ConfigCommands;