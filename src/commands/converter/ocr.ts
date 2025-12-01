import type { ConfigCommands } from "../../types/structure/commands";
import { converter } from "../../utils";

export default {
    name: "ocr",
    alias: ["scantext"],
    usage: "[reply]",
    category: "converter",
    description: "Convert Image to Text",
    cooldown: 3,
    async run({ Chisato, from, message }) {
        let { quoted } = message;
        if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
            await Chisato.sendReaction(from, "⏳", message.key);
            let buffer = quoted !== null ? await quoted.download() : await message.download();
            converter
                .ocrScanner(buffer)
                .then(async (data) => {
                    if (data.IsErroredOnProcessing === true || data.ParsedResults[0].ParsedText === "") {
                        await Chisato.sendReaction(from, "❌", message.key);
                        return Chisato.sendText(from, "*「 ! 」* Can't find Text in Image!", message);
                    }
                    await Chisato.sendText(from, data.ParsedResults[0].ParsedText, null, message);
                    await Chisato.sendReaction(from, "✅", message.key);
                    buffer = null;
                })
                .catch(async (err) => {
                    await Chisato.sendReaction(from, "❌", message.key);
                    await Chisato.sendText(
                        from,
                        "*「 ! 」* There is an error. Please report it to the bot creator immediately!",
                        message
                    );
                });
        } else {
            await Chisato.sendText(from, "*「 ! 」* Please reply to the image!", message);
        }
    },
} satisfies ConfigCommands;