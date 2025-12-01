import type { ConfigCommands } from "../../types/structure/commands";
import { StickerGenerator } from "../../utils/converter/sticker";
import fs from "fs";

export default {
    name: "emojimix",
    alias: ["emix", "mixemoji"],
    usage: "[emoji1] [emoji2]",
    category: "converter",
    description: "Mix two emojis to create a new combined emoji sticker",
    cooldown: 3,
    example: `*「 EMOJI MIX 」*

😄 Mix two emojis to create a new combined emoji sticker
📝 *Usage:*
{prefix}{command.name} <emoji1> <emoji2>
💡 *Example:*
{prefix}{command.name} 😀 😎
`,
    async run({ Chisato, from, message, args }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            if (args.length < 2) {
                await Chisato.sendReaction(from, "❌", message.key);
                return await Chisato.sendText(
                    from,
                    `❌ *EMOJI MIX*\n\nPlease provide two emojis!\n\n*Usage:* ${this.usage}\n*Example:* .emojimix 😀 😎`,
                    message
                );
            }

            const emoji1 = args[0];
            const emoji2 = args[1];

            const result = await StickerGenerator.emojiMix(emoji1, emoji2);

            if (result.error) {
                await Chisato.sendReaction(from, "❌", message.key);
                return await Chisato.sendText(
                    from,
                    `❌ ${result.message}`,
                    message
                );
            }

            if (!result.url) {
                await Chisato.sendReaction(from, "❌", message.key);
                return await Chisato.sendText(
                    from,
                    `❌ Failed to mix emojis. Please try different emojis!`,
                    message
                );
            }

            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

            await Chisato.sendMediaAsSticker(
                from,
                { pack: stickers.packname, author: stickers.author },
                Buffer.from(await (await fetch(result.url)).arrayBuffer()),
                "default",
                message
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to create emoji mix sticker: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
