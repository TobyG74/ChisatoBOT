import type { ConfigCommands } from "../../types/structure/commands";
import { fetchHSRUser } from "../../utils/scrapers/lookup";
import { generateHSRImage } from "../../utils/converter/enka-card";

export default {
    name: "hsr",
    alias: ["starrail", "honkaistarrail", "hsrcheck"],
    usage: "[UID]",
    category: "lookup",
    description: "Lookup Honkai: Star Rail player profile via Enka.Network",
    cooldown: 15,
    limit: 2,
    interactiveSelection: true,
    example: `*「 HONKAI: STAR RAIL 」*

🚀 Lookup a Honkai: Star Rail player profile!

📝 *How to use:*
{prefix}{command.name} [UID]

💡 *Example:*
• {prefix}{command.name} 800708475`,
    async run({ Chisato, from, query, message, command, prefix }) {
        const rawQuery = query?.trim() ?? "";
        if (!rawQuery) {
            return Chisato.sendText(from, `*「 HONKAI: STAR RAIL 」*\n\n❌ Please provide a valid UID.\n\n📝 *Usage:*\n${prefix}${command.name} [UID]`, message);
        }

        // uid|charIndex – response from list selection
        const pipeIdx = rawQuery.indexOf("|");
        if (pipeIdx !== -1) {
            const uid = rawQuery.slice(0, pipeIdx);
            const charIdx = parseInt(rawQuery.slice(pipeIdx + 1)) || 0;
            if (isNaN(Number(uid))) return Chisato.sendText(from, `❌ Invalid UID.`, message);
            try {
                await Chisato.sendReaction(from, "⏳", message.key);
                const user = await fetchHSRUser(uid);
                const char = user.characters[charIdx];
                if (!char) return Chisato.sendText(from, `❌ Character not found.`, message);
                const [img] = await generateHSRImage({ ...user, characters: [char] });
                await Chisato.sendImage(from, img, `🌟 *${char.name}* | ${user.nickname}  ·  UID ${user.uid}`, message);
                await Chisato.sendReaction(from, "✅", message.key);
            } catch (error: any) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, `❌ ${error?.message || "Failed."}`, message);
            }
            return;
        }

        const uid = rawQuery;
        if (isNaN(Number(uid))) {
            return Chisato.sendText(from, `*「 HONKAI: STAR RAIL 」*\n\n❌ Please provide a valid UID.`, message);
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            const user = await fetchHSRUser(uid);

            if (user.characters.length <= 1) {
                // Single or no character: send card directly
                const images = await generateHSRImage(user);
                const header = `🚀 *${user.nickname}* | UID: ${user.uid}\n🔗 ${user.url}`;
                for (let i = 0; i < images.length; i++) {
                    await Chisato.sendImage(from, images[i], i === 0 ? header : `Character ${i + 1}/${images.length}`, message);
                }
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            // Multiple characters: show selection list
            const builder = new (Chisato as any).TemplateBuilder.Native(Chisato);
            const rows = user.characters.map((char, i) => ({
                title: char.name,
                description: `Lv.${char.level} E${char.eidolons} · ${char.element} · ${char.path}`,
                id: `${prefix}hsr ${uid}|${i}`,
            }));

            builder
                .mainBody(`*「 HONKAI: STAR RAIL 」*\n\n👤 *${user.nickname}*  ·  UID ${uid}\n📊 TL${user.level}  ·  EQ${user.worldLevel}\n\n_Pilih karakter yang ingin ditampilkan:_`)
                .mainFooter("enka.network · ChisatoBOT")
                .buttons(builder.button.list({ display: "🌟 Pilih Karakter", sections: [{ title: "Characters in Showcase", rows }] }));

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(from, `*「 HONKAI: STAR RAIL 」*\n\n❌ ${error?.message || "Failed to fetch player data."}`, message);
        }
    },
} satisfies ConfigCommands;

