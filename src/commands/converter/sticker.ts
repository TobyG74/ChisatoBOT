import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "sticker",
    alias: ["stk", "stc", "stiker", "s"],
    usage: "<option> (default|full|circle)",
    category: "converter",
    description: "Convert Image / Video to Sticker",
    isProcess: true,
    async run({ Chisato, args, from, message }) {
        try {
            let { quoted } = message;
            let buffer: Buffer | null;
            let type = args[0];
            const { stickers } = Chisato.config;
            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: stickers.packname, author: stickers.author },
                    buffer,
                    type,
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
                    type,
                    message
                );
                buffer = null;
            } else {
                await Chisato.sendText(
                    from,
                    "Please reply to the image / video that your want to use as Sticker!",
                    message
                );
            }
        } catch (e) {
            Chisato.sendText(from, "There is an error. Please report it to the bot creator immediately!", message);
        }
    },
};
