import type { ConfigCommands } from "../../types/structure/commands";
import { fetchAllCharacters } from "../../utils/scrapers/lookup";

export default {
    name: "genshincharacters",
    alias: ["gicharacters", "gichar", "genshinchar"],
    usage: "[element/weapon]",
    category: "lookup",
    description: "List all Genshin Impact playable characters",
    cooldown: 10,
    limit: 2,
    example: `*「 GENSHIN CHARACTERS 」*

📋 List all Genshin Impact characters!

📝 *How to use:*
{prefix}{command.name} — show all
{prefix}{command.name} [filter] — filter by element or weapon

💡 *Example:*
• {prefix}{command.name}
• {prefix}{command.name} pyro
• {prefix}{command.name} sword`,
    async run({ Chisato, from, query, message, command }) {
        try {
            await Chisato.sendReaction(from, "⏳", message.key);

            let characters = await fetchAllCharacters();
            const filter = query?.trim().toLowerCase();

            if (filter) {
                characters = characters.filter(
                    (c) =>
                        c.element.toLowerCase().includes(filter) ||
                        c.weaponType.toLowerCase().includes(filter)
                );
            }

            if (characters.length === 0) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, `*「 GENSHIN CHARACTERS 」*\n\n❌ No characters found for "${filter}".`, message);
            }

            let text = `*「 GENSHIN CHARACTERS 」*\n`;
            text += `📋 Total: ${characters.length} characters\n`;
            if (filter) text += `🔍 Filter: ${filter}\n`;
            text += `\n`;

            for (const c of characters) {
                text += `${"★".repeat(c.rarity)} *${c.name}*\n`;
                text += `   ${c.element} • ${c.weaponType}\n`;
            }

            text += `\n✨ Data from Enka.Network`;

            await Chisato.sendText(from, text, message);
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(from, `*「 GENSHIN CHARACTERS 」*\n\n❌ ${error?.message || "Failed to fetch characters."}`, message);
        }
    },
} satisfies ConfigCommands;
