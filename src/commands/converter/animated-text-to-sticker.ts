import type { ConfigCommands } from "../../types/structure/commands";
import { generateAnimatedText } from "../../utils/animated-sticker";

export default {
    name: "animatedtext",
    alias: ["atts", "attp", "animatedtextsticker"],
    usage: "<text>",
    category: "converter",
    description: "Convert text to animated rainbow sticker",
    cooldown: 5,
    async run({ Chisato, args, from, message }) {
        if (!args || args.length === 0) {
            return Chisato.sendText(
                from,
                `❌ *ANIMATED TEXT TO STICKER*\n\nPlease provide text to convert!\n\nUsage: .attp <text>\n\nExample:\n.attp Hello World\n.attp Good Morning!`,
                message
            );
        }

        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const text = args.join(" ");
            const animatedBuffer = await generateAnimatedText(text);

            await Chisato.sendMessage(from, {
                sticker: animatedBuffer
            }, { quoted: message });

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            console.error("Animated text to sticker error:", error);
            await Chisato.sendText(
                from,
                `❌ Failed to create animated sticker. Error: ${error.message}\n\nMake sure img2webp (webp tools) is installed on your system.`,
                message
            );
        }
    },
} satisfies ConfigCommands;
