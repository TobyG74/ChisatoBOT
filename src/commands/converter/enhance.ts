import type { ConfigCommands } from "../../types/structure/commands";
import { enhanceImage } from "../../utils/scrapers/converter/enhance";

export default <ConfigCommands>{
    name: "enhance",
    alias: ["remini", "tohd"],
    usage: "<reply>",
    category: "converter",
    description: "Convert Image to hd Quality",
    limit: 4,
    cooldown: 10,
    isPremium: true,
    isProcess: true,
    async run({ Chisato, from, message }) {
        try {
            let { quoted } = message;
            let buffer: Buffer | null;
            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                const remini = await enhanceImage(buffer, "enhance")
                await Chisato.sendImage(from, remini, null, message);
            } else {
                await Chisato.sendText(
                    from,
                    "*「 ! 」* Please reply to the image you want to enhance",
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
