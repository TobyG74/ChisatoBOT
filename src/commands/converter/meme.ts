import type { ConfigCommands } from "../../types/structure/commands";
import { StickerGenerator } from "../../utils/converter/sticker";

export default {
    name: "meme",
    alias: ["memegen", "memegenerator"],
    usage: "[top text]|[bottom text]",
    category: "converter",
    description: "Add text to image to create meme",
    cooldown: 3,
    example: `*「 MEME GENERATOR 」*
😂 Add text to image to create meme
📝 *Usage:*
{prefix}{command.name} [top text]|[bottom text]
{prefix}{command.name} [single text]
💡 *Example:*
{prefix}{command.name} TODAY IS FUNNY|MAKE ME LAUGH
{prefix}{command.name} WTF IS THAT
`,
    async run({ Chisato, args, from, message, prefix }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            let { quoted } = message;
            let imageBuffer: Buffer | null = null;

            if (quoted?.type === "imageMessage") {
                imageBuffer = await quoted.download();
            } else if (message?.type === "imageMessage") {
                imageBuffer = await message.download();
            } else {
                await Chisato.sendReaction(from, "❌", message.key);
                let text = `*「 MEME GENERATOR 」*\n\n`;
                text += `😂 Add text to image to create meme!\n\n`;
                text += `📝 *How to use:*\n`;
                text += `1️⃣ Reply to an image with ${prefix}meme [top text]|[bottom text]\n`;
                text += `2️⃣ Reply to an image with ${prefix}meme [single text]\n\n`;
                text += `💡 *Example:*\n`;
                text += `• ${prefix}meme TODAY IS FUNNY|MAKE ME LAUGH\n`;
                text += `• ${prefix}meme WTF IS THAT\n\n`;
                text += `✨ Create funny memes easily!`;
                await Chisato.sendText(from, text, message);
                return;
            }

            if (!imageBuffer) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Failed to download image. Please try again.",
                    message
                );
            }

            const inputText = args.join(" ");
            if (!inputText) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    `❌ Please provide text!\n\nUsage: ${prefix}meme [top text]|[bottom text]`,
                    message
                );
            }

            let topText = "";
            let bottomText = "";

            if (inputText.includes("|")) {
                const [top, bottom] = inputText.split("|");
                topText = top.trim();
                bottomText = bottom.trim();
            } else {
                topText = inputText.trim();
            }

            const resultBuffer = await StickerGenerator.generateMeme(
                imageBuffer,
                topText,
                bottomText || undefined
            );

            await Chisato.sendMessage(
                from,
                {
                    image: resultBuffer,
                    caption: "✅ Meme created successfully! 😂"
                },
                { quoted: message }
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to create meme: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
