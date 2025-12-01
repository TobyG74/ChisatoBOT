import type { ConfigCommands } from "../../types/structure/commands";
import { StickerGenerator } from "../../utils/converter/sticker";

export default {
    name: "animatedtext",
    alias: ["atts", "attp", "animatedtextsticker"],
    usage: "[text]",
    category: "converter",
    description: "Convert text to animated rainbow sticker",
    cooldown: 5,
    example: `*「 ANIMATED TEXT TO STICKER 」*

🌈 Convert text to animated rainbow sticker

📝 *Usage:*
{prefix}{command.name} <text>

💡 *Example:*
{prefix}{command.name} Hello World
{prefix}{command.alias} Good Morning!`,
    async run({ Chisato, args, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const text = args.join(" ");
            const animatedBuffer = await StickerGenerator.generateAnimatedText(text);

            await Chisato.sendMessage(from, {
                sticker: animatedBuffer
            }, { quoted: message });

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            await Chisato.sendText(
                from,
                `❌ Failed to create animated sticker: ${error instanceof Error ? error.message : 'Unknown error'}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
