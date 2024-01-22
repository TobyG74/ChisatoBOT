import type { ConfigCommands } from "../../types/commands";
import { runtime } from "../../utils/function";

export default <ConfigCommands>{
    name: "runtime",
    alias: ["rtime", "uptime"],
    category: "misc",
    description: "See the running time of the bot",
    async run({ Chisato, from, message }) {
        const time = process.uptime();
        await Chisato.sendText(from, `This bot has been running for ${runtime(time)}`, message);
    },
};
