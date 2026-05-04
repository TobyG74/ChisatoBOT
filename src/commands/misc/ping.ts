import type { ConfigCommands } from "../../types/structure/commands";

export default {
    name: "ping",
    alias: ["speed"],
    category: "misc",
    description: "See the ping of bot",
    async run({ Chisato, from, message }) {
        const start = Date.now();
        const sent = await Chisato.sendText(from, "🏓 Pong!", message, {
            contextInfo: { expiration: 0 },
        });
        const latency = Date.now() - start;

        const ms = latency < 1000
            ? `${latency}ms`
            : `${(latency / 1000).toFixed(2)}s`;

        await Chisato.sendMessage(from, {
            text: `🏓 Pong!\n⚡ Ping : ${ms}`,
            edit: sent!.key,
        });
    },
} satisfies ConfigCommands;