import type { ConfigCommands } from "../../types/structure/commands";
import fs from "fs";
import { StickerGenerator } from "../../utils/converter/sticker";

export default {
    name: "texttosticker",
    alias: ["textsticker", "ttp"],
    usage: "[text]",
    category: "converter",
    description: "Convert text to sticker image",
    cooldown: 3,
    example: `*「 TEXT TO STICKER 」*

📝 Convert text to sticker image

📝 *Usage:*
{prefix}{command.name} <text>

💡 *Example:*
{prefix}{command.name} Hello World
{prefix}{command.alias} Good Morning!`,
    async run({ Chisato, args, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const text = args.join(" ");
            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

            const imageBuffer = await StickerGenerator.generateTextSticker(text);

            await Chisato.sendMediaAsSticker(
                from,
                { pack: stickers.packname, author: stickers.author },
                imageBuffer,
                "default",
                message
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to create sticker: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
