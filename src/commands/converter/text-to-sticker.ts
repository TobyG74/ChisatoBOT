import type { ConfigCommands } from "../../types/structure/commands";
import { StickerTypes } from "wa-sticker-formatter";
import fs from "fs";
import { createCanvas } from "@napi-rs/canvas";

export default {
    name: "texttosticker",
    alias: ["tts", "textsticker", "ttp"],
    usage: "<text>",
    category: "converter",
    description: "Convert text to sticker image",
    cooldown: 3,
    async run({ Chisato, args, from, message }) {
        if (!args || args.length === 0) {
            return Chisato.sendText(
                from,
                `❌ *TEXT TO STICKER*\n\nPlease provide text to convert!\n\nUsage: .ttp <text>\n\nExample:\n.ttp Hello World\n.ttp Good Morning!`,
                message
            );
        }

        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            const text = args.join(" ");
            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

            const width = 512;
            const height = 512;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);

            const baseFontSize = 100;
            const fontSize = Math.min(baseFontSize, Math.floor(width / (text.length * 0.6)));
            
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillText(text, width / 2, height / 2);

            const imageBuffer = await canvas.encode('png');

            await Chisato.sendMediaAsSticker(
                from,
                { pack: stickers.packname, author: stickers.author },
                imageBuffer,
                StickerTypes.DEFAULT,
                message
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            console.error("Text to sticker error:", error);
            await Chisato.sendText(
                from,
                `❌ Failed to create sticker. Error: ${error.message}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
