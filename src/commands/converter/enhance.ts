import type { ConfigCommands } from "../../types/structure/commands";
import { enhanceImage } from "../../utils/scrapers/converter/enhance";

export default <ConfigCommands>{
    name: "enhance",
    alias: ["remini", "tohd"],
    usage: "<reply>",
    category: "converter",
    description: "Convert image to HD quality",
    limit: 4,
    cooldown: 10,
    isPremium: true,
    isProcess: true,
    async run({ Chisato, from, message }) {
        try {
            const { quoted } = message;
            const buffer = quoted ? await quoted.download() : await message.download();

            if (buffer && (message.type === "imageMessage" || quoted?.type === "imageMessage")) {
                const remini = await enhanceImage(buffer, "enhance");
                await Chisato.sendImage(from, remini, null, message);
            } else {
                await Chisato.sendText(
                    from,
                    "*「 ! 」* Please reply to the image you want to enhance",
                    message
                );
            }
        } catch (error) {
            console.error(error); // Log the error for debugging
            await Chisato.sendText(
                from,
                "*「 ! 」* An error occurred. Please report it to the bot creator immediately!",
                message
            );
        }
    },
};
