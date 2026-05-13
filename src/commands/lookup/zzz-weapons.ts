import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllZZZWeapons } from "../../utils/scrapers/lookup/enka-zzz.scraper";

export default {
    name: "zzzweapons",
    alias: ["zzzweapon", "zzzwengine", "wengine"],
    usage: "[specialty/rarity]",
    category: "lookup",
    description: "List all Zenless Zone Zero W-Engines",
    cooldown: 10,
    limit: 2,
    example: `*「 ZZZ W-ENGINES 」*

⚔️ List all ZZZ W-Engines!

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} anomaly
• {prefix}{command.name} 5`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            let weps = await fetchAllZZZWeapons();
            const filter = query?.trim().toLowerCase();
            if (filter) {
                const r = Number(filter);
                weps = weps.filter(w => w.specialty.toLowerCase().includes(filter) || (!isNaN(r) && w.rarity === r));
            }
            if (!weps.length) { await Chisato.sendReaction(from, "❌", message.key); return Chisato.sendText(from, `❌ No W-Engines found for "${filter}".`, message); }

            let text = `*「 ZZZ W-ENGINES 」*\n⚔️ Total: ${weps.length}\n${filter ? `🔍 Filter: ${filter}\n` : ""}\n`;
            for (const w of weps) text += `${"★".repeat(w.rarity)} *${w.name}*\n   ${w.specialty}\n`;
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
