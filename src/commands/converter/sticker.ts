import type { ConfigCommands } from "../../types/structure/commands";
import { StickerType } from "../../utils/converter/sticker";
import fs from "fs";

export default {
    name: "sticker",
    alias: ["stk", "stc", "stiker", "s"],
    usage: "[option] (default|full|circle)",
    category: "converter",
    description: "Convert Image / Video to Sticker",
    cooldown: 2,
    async run({ Chisato, args, from, message, prefix }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        try {
            let { quoted } = message;
            let buffer: Buffer | null;
            let type = args[0] as StickerType;
            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: stickers.packname, author: stickers.author },
                    buffer,
                    type || "default",
                    message
                );
                buffer = null;
            } else if (message?.type === "videoMessage" || quoted?.type === "videoMessage") {
                const seconds =
                    quoted !== null ? quoted.message[quoted.type].seconds : message.message[message.type].seconds;
                if (seconds > 10)
                    return Chisato.sendText(
                        from,
                        "Sorry, The video your sent is too long, Maksimum 10 Seconds!",
                        message
                    );
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: stickers.packname, author: stickers.author },
                    buffer,
                    type || "default",
                    message
                );
                buffer = null;
            } else {
                await Chisato.sendReaction(from, "❌", message.key);
                let text = `*「 STICKER CONVERTER 」*\n\n`;
                text += `🎨 Convert image or video to sticker!\n\n`;
                text += `📝 *How to use:*\n`;
                text += `1️⃣ Reply to an image/video with ${prefix}sticker\n`;
                text += `2️⃣ Send image/video with caption ${prefix}sticker\n`;
                text += `3️⃣ Add option: ${prefix}sticker [default|full|circle]\n\n`;
                text += `💡 *Example:*\n`;
                text += `• ${prefix}sticker (reply to image/video)\n`;
                text += `• ${prefix}sticker full (full size sticker)\n`;
                text += `• ${prefix}sticker circle (circle shaped sticker)\n\n`;
                text += `⚠️ *Note:* Video maximum 10 seconds\n`;
                text += `✨ Powered by ChisatoBOT`;
                await Chisato.sendText(from, text, message);
                return;
            }
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to convert to sticker. Please try again.\n\nError: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;