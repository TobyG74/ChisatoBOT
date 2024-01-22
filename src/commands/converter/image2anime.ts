import type { ConfigCommands } from "../../types/commands";
import { converter } from "../../utils";

/**
 * You need Chinnese & Indonesian Proxy to this command
 */

export default <ConfigCommands>{
    name: "toanime",
    alias: ["jadianime", "tomanga", "tocomic", "mangaai"],
    usage: "<reply>",
    category: "converter",
    description: "Convert Image to Anime",
    isProcess: true,
    async run({ Chisato, from, message }) {
        try {
            let { quoted } = message;
            let buffer: Buffer | null;
            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                const data = await converter.Sticker.Anime(buffer);
                if (!Buffer.isBuffer(data)) return Chisato.sendText(from, "Face Not Found! Try Another Image", message);
                await Chisato.sendImage(from, data, null, message);
                buffer = null;
            } else {
                await Chisato.sendText(
                    from,
                    "*「 ! 」* Please reply to the image you want to use to create an anime image!",
                    message
                );
            }
        } catch (e) {
            Chisato.sendText(
                from,
                "*「 ! 」* There is an error. Please report it to the bot creator immediately!",
                message
            );
        }
    },
};
