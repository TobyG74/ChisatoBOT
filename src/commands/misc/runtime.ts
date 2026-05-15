import type { ConfigCommands } from "../../types/structure/commands";
import { Formatters } from "../../utils/core";
import { getLogicalUptimeSeconds } from "../../core/runtime";

export default {
    name: "runtime",
    alias: ["rtime", "uptime"],
    category: "misc",
    description: "See the running time of the bot",
    async run({ Chisato, from, message }) {
        // Logical uptime survives auto-restarts (e.g. memory-triggered restarts),
        // so the user sees an uninterrupted runtime.
        const time = getLogicalUptimeSeconds();
        await Chisato.sendText(
            from,
            `This bot has been running for ${Formatters.runtime(time)}`,
            message
        );
    },
} satisfies ConfigCommands;
