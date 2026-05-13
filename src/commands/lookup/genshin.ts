import type { ConfigCommands } from "../../types/structure/commands";
import { fetchEnkaUser } from "../../utils/scrapers/lookup";
import { generateGenshinImage } from "../../utils/converter/enka-card";

export default {
    name: "genshin",
    alias: ["gi", "enka", "genshincheck"],
    usage: "[UID]",
    category: "lookup",
    description: "Lookup Genshin Impact player profile via Enka.Network",
    cooldown: 10,
    limit: 2,
    interactiveSelection: true,
    example: `*「 GENSHIN IMPACT 」*

🎮 Lookup a Genshin Impact player profile!

📝 *How to use:*
{prefix}{command.name} [UID]

💡 *Example:*
• {prefix}{command.name} 800000001`,
    async run({ Chisato, from, query, message, command, prefix }) {
        const rawQuery = query?.trim() ?? "";
        if (!rawQuery) {
            return Chisato.sendText(from, `*「 GENSHIN IMPACT 」*\n\n❌ Please provide a valid UID.\n\n📝 *Usage:*\n${prefix}${command.name} [UID]`, message);
        }

        // uid|charIndex – response from list selection
        const pipeIdx = rawQuery.indexOf("|");
        if (pipeIdx !== -1) {
            const uid = rawQuery.slice(0, pipeIdx);
            const charIdx = parseInt(rawQuery.slice(pipeIdx + 1)) || 0;
            if (isNaN(Number(uid))) return Chisato.sendText(from, `❌ Invalid UID.`, message);
            try {
                await Chisato.sendReaction(from, "⏳", message.key);
                const user = await fetchEnkaUser(uid);
                const char = user.characters[charIdx];
                if (!char) return Chisato.sendText(from, `❌ Character not found.`, message);
                const [img] = await generateGenshinImage({ ...user, characters: [char] });
                await Chisato.sendImage(from, img, `🎮 *${char.name ?? "Unknown"}* | ${user.nickname}  ·  UID ${user.uid}`, message);
                await Chisato.sendReaction(from, "✅", message.key);
            } catch (error: any) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, `❌ ${error?.message || "Failed."}`, message);
            }
            return;
        }

        const uid = rawQuery;
        if (isNaN(Number(uid))) {
            return Chisato.sendText(from, `*「 GENSHIN IMPACT 」*\n\n❌ Please provide a valid UID.`, message);
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            const user = await fetchEnkaUser(uid);

            if (user.characters.length <= 1) {
                const images = await generateGenshinImage(user);
                const header = `🎮 *${user.nickname}* | UID: ${user.uid}\n🔗 ${user.url}`;
                for (let i = 0; i < images.length; i++) {
                    await Chisato.sendImage(from, images[i], i === 0 ? header : "", message);
                }
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            // Multiple characters: show selection list
            const builder = new (Chisato as any).TemplateBuilder.Native(Chisato);
            const rows = user.characters.map((char, i) => ({
                title: char.name ?? `Character ${i + 1}`,
                description: `Lv.${char.level} C${char.constellation} · ${char.element} · ${char.weaponType}`,
                id: `${prefix}genshin ${uid}|${i}`,
            }));

            builder
                .mainBody(`*「 GENSHIN IMPACT 」*\n\n👤 *${user.nickname}*  ·  UID ${uid}\n📊 AR${user.level}  ·  WL${user.worldLevel}\n\n_Pilih karakter yang ingin ditampilkan:_`)
                .mainFooter("enka.network · ChisatoBOT")
                .buttons(builder.button.list({ display: "🎮 Pilih Karakter", sections: [{ title: "Characters in Showcase", rows }] }));

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(from, `*「 GENSHIN IMPACT 」*\n\n❌ ${error?.message || "Failed to fetch player data."}`, message);
        }
    },
} satisfies ConfigCommands;

