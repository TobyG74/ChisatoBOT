import type { ConfigCommands } from "../../types/structure/commands";
import { fetchZZZUser } from "../../utils/scrapers/lookup";
import { generateZZZImage } from "../../utils/converter/enka-card";

export default {
    name: "zzz",
    alias: ["zenless", "zenlesszonezero", "zzzcheck"],
    usage: "[UID]",
    category: "lookup",
    description: "Lookup Zenless Zone Zero player profile via Enka.Network",
    cooldown: 10,
    limit: 2,
    interactiveSelection: true,
    example: `*「 ZENLESS ZONE ZERO 」*

🎮 Lookup a Zenless Zone Zero player profile!

📝 *How to use:*
{prefix}{command.name} [UID]

💡 *Example:*
• {prefix}{command.name} 1000185791`,
    async run({ Chisato, from, query, message, command, prefix }) {
        const rawQuery = query?.trim() ?? "";
        if (!rawQuery) {
            return Chisato.sendText(from, `*「 ZENLESS ZONE ZERO 」*\n\n❌ Please provide a valid UID.\n\n📝 *Usage:*\n${prefix}${command.name} [UID]`, message);
        }

        // uid|agentIndex – response from list selection
        const pipeIdx = rawQuery.indexOf("|");
        if (pipeIdx !== -1) {
            const uid = rawQuery.slice(0, pipeIdx);
            const agentIdx = parseInt(rawQuery.slice(pipeIdx + 1)) || 0;
            if (isNaN(Number(uid))) return Chisato.sendText(from, `❌ Invalid UID.`, message);
            try {
                await Chisato.sendReaction(from, "⏳", message.key);
                const user = await fetchZZZUser(uid);
                const agent = user.agents[agentIdx];
                if (!agent) return Chisato.sendText(from, `❌ Agent not found.`, message);
                const [img] = await generateZZZImage({ ...user, agents: [agent] });
                await Chisato.sendImage(from, img, `⚡ *${agent.name}* | ${user.nickname}  ·  UID ${user.uid}`, message);
                await Chisato.sendReaction(from, "✅", message.key);
            } catch (error: any) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(from, `❌ ${error?.message || "Failed."}`, message);
            }
            return;
        }

        const uid = rawQuery;
        if (isNaN(Number(uid))) {
            return Chisato.sendText(from, `*「 ZENLESS ZONE ZERO 」*\n\n❌ Please provide a valid UID.`, message);
        }

        try {
            await Chisato.sendReaction(from, "⏳", message.key);
            const user = await fetchZZZUser(uid);

            if (user.agents.length <= 1) {
                const images = await generateZZZImage(user);
                const header = `⚡ *${user.nickname}* | UID: ${user.uid}\n🔗 ${user.url}`;
                for (let i = 0; i < images.length; i++) {
                    await Chisato.sendImage(from, images[i], i === 0 ? header : "", message);
                }
                await Chisato.sendReaction(from, "✅", message.key);
                return;
            }

            // Multiple agents: show selection list
            const builder = new (Chisato as any).TemplateBuilder.Native(Chisato);
            const rows = user.agents.map((agent, i) => ({
                title: agent.name,
                description: `Lv.${agent.level} M${agent.mindscape} · ${agent.element?.join("/") ?? "Unknown"} · ${agent.specialty}`,
                id: `${prefix}zzz ${uid}|${i}`,
            }));

            builder
                .mainBody(`*「 ZENLESS ZONE ZERO 」*\n\n👤 *${user.nickname}*  ·  UID ${uid}\n📊 Inter-Knot Lv.${user.level}\n\n_Pilih agen yang ingin ditampilkan:_`)
                .mainFooter("enka.network · ChisatoBOT")
                .buttons(builder.button.list({ display: "⚡ Pilih Agen", sections: [{ title: "Agents in Showcase", rows }] }));

            const msg = await builder.render();
            await Chisato.relayMessage(from, msg.message, { messageId: msg.key.id });
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.logger.error(command.name, error?.message || error);
            return Chisato.sendText(from, `*「 ZENLESS ZONE ZERO 」*\n\n❌ ${error?.message || "Failed to fetch player data."}`, message);
        }
    },
} satisfies ConfigCommands;

