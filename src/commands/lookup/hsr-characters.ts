import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllHSRCharacters } from "../../utils/scrapers/lookup/enka-hsr.scraper";

export default {
    name: "hsrcharacters",
    alias: ["hsrchar", "starrailchar"],
    usage: "[element/path]",
    category: "lookup",
    description: "List all Honkai: Star Rail playable characters",
    cooldown: 10,
    limit: 2,
    example: `*「 HSR CHARACTERS 」*

📋 List all HSR characters!

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} quantum
• {prefix}{command.name} harmony`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            let chars = await fetchAllHSRCharacters();
            const filter = query?.trim().toLowerCase();
            if (filter) chars = chars.filter(c => c.element.toLowerCase().includes(filter) || c.path.toLowerCase().includes(filter));
            if (!chars.length) { await Chisato.sendReaction(from, "❌", message.key); return Chisato.sendText(from, `❌ No characters found for "${filter}".`, message); }

            let text = `*「 HSR CHARACTERS 」*\n📋 Total: ${chars.length}\n${filter ? `🔍 Filter: ${filter}\n` : ""}\n`;
            for (const c of chars) text += `${"★".repeat(c.rarity)} *${c.name}*\n   ${c.element} • ${c.path}\n`;
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
