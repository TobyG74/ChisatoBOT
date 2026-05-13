import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllZZZAgents } from "../../utils/scrapers/lookup/enka-zzz.scraper";

export default {
    name: "zzzagents",
    alias: ["zzzchar", "zzzcharacters", "zenlessagents"],
    usage: "[element/specialty]",
    category: "lookup",
    description: "List all Zenless Zone Zero agents",
    cooldown: 10,
    limit: 2,
    example: `*「 ZZZ AGENTS 」*

📋 List all ZZZ agents!

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} fire
• {prefix}{command.name} anomaly`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            let agents = await fetchAllZZZAgents();
            const filter = query?.trim().toLowerCase();
            if (filter) agents = agents.filter(a => a.element.some(e => e.toLowerCase().includes(filter)) || a.specialty.toLowerCase().includes(filter));
            if (!agents.length) { await Chisato.sendReaction(from, "❌", message.key); return Chisato.sendText(from, `❌ No agents found for "${filter}".`, message); }

            let text = `*「 ZZZ AGENTS 」*\n📋 Total: ${agents.length}\n${filter ? `🔍 Filter: ${filter}\n` : ""}\n`;
            for (const a of agents) text += `${"★".repeat(a.rarity)} *${a.name}*\n   ${a.element.join("/")} • ${a.specialty}\n`;
            text += `\n✨ Data from Enka.Network`;
            await Chisato.sendText(from, text, message);
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (e: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, e?.message || e);
            return Chisato.sendText(from, `❌ ${e?.message || "Failed to fetch."}`, message);
        }
    },
} satisfies ConfigCommands;
