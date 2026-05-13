import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllWeapons } from "../../utils/scrapers/lookup";

export default {
    name: "genshinweapons",
    alias: ["giweapons", "giweapon", "genshinweapon"],
    usage: "[type/rarity]",
    category: "lookup",
    description: "List all Genshin Impact weapons",
    cooldown: 10,
    limit: 2,
    example: `*「 GENSHIN WEAPONS 」*

⚔️ List all Genshin Impact weapons!

📝 *How to use:*
{prefix}{command.name} — show all
{prefix}{command.name} [filter] — filter by type or rarity

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} sword
• {prefix}{command.name} 5`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            let weapons = await fetchAllWeapons();
            const filter = query?.trim().toLowerCase();

            if (filter) {
                const rarityFilter = Number(filter);
                weapons = weapons.filter(
                    (w) =>
                        w.type.toLowerCase().includes(filter) ||
                        (!isNaN(rarityFilter) && w.rarity === rarityFilter)
                );
            }

            if (weapons.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, `*「 GENSHIN WEAPONS 」*\n\n❌ No weapons found for "${filter}".`, message);
            }

            let text = `*「 GENSHIN WEAPONS 」*\n`;
            text += `⚔️ Total: ${weapons.length} weapons\n`;
            if (filter) text += `🔍 Filter: ${filter}\n`;
            text += `\n`;

            for (const w of weapons) {
                text += `${"★".repeat(w.rarity)} *${w.name}*\n`;
                text += `   ${w.type}\n`;
            }

            text += `\n✨ Data from genshin.jmp.blue`;

            await Chisato.sendText(from, text, message);
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(from, `*「 GENSHIN WEAPONS 」*\n\n❌ ${error?.message || "Failed to fetch weapons."}`, message);
        }
    },
} satisfies ConfigCommands;
