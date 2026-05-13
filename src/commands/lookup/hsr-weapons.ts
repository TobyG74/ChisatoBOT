import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllHSRWeapons } from "../../utils/scrapers/lookup/enka-hsr.scraper";

export default {
    name: "hsrweapons",
    alias: ["hsrweapon", "hsrlc", "lightcone"],
    usage: "[path/rarity]",
    category: "lookup",
    description: "List all Honkai: Star Rail Light Cones",
    cooldown: 10,
    limit: 2,
    example: `*「 HSR LIGHT CONES 」*
    
⚔️ List all HSR Light Cones!

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} harmony
• {prefix}{command.name} 5`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            let weps = await fetchAllHSRWeapons();
            const filter = query?.trim().toLowerCase();
            if (filter) {
                const r = Number(filter);
                weps = weps.filter(w => w.path.toLowerCase().includes(filter) || (!isNaN(r) && w.rarity === r));
            }
            if (!weps.length) { await Chisato.sendReaction(from, "❌", message.key); return Chisato.sendText(from, `❌ No weapons found for "${filter}".`, message); }

            let text = `*「 HSR LIGHT CONES 」*\n⚔️ Total: ${weps.length}\n${filter ? `🔍 Filter: ${filter}\n` : ""}\n`;
            for (const w of weps) text += `${"★".repeat(w.rarity)} *${w.name}*\n   ${w.path}\n`;
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
