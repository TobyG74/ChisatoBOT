import { StickerTypes } from "wa-sticker-formatter";
import type { ConfigCommands } from "../../types/structure/commands";
import fs from "fs";

export default {
    name: "sticker",
    alias: ["stk", "stc", "stiker", "s"],
    usage: "<option> (default|full|circle)",
    category: "converter",
    description: "Convert Image / Video to Sticker",
    cooldown: 2,
    async run({ Chisato, args, from, message }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        try {
            let { quoted } = message;
            let buffer: Buffer | null;
            let type = args[0] as StickerTypes;
            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: stickers.packname, author: stickers.author },
                    buffer,
                    type || StickerTypes.DEFAULT,
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
                    type || StickerTypes.DEFAULT,
                    message
                );
                buffer = null;
            } else {
                await Chisato.sendReaction(from, "❌", message.key);
                await Chisato.sendText(
                    from,
                    "Please reply to the image / video that your want to use as Sticker!",
                    message
                );
                return;
            }
            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            Chisato.sendText(from, "There is an error. Please report it to the bot creator immediately!", message);
        }
    },
} satisfies ConfigCommands;