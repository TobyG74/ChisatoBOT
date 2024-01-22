import { ConfigCommands } from "../../types/commands";
import { converter } from "../../utils";

export default <ConfigCommands>{
    name: "ocr",
    alias: ["scantext"],
    usage: "<reply>",
    category: "converter",
    description: "Convert Image to Text",
    isProcess: true,
    async run({ Chisato, from, message }) {
        let { quoted } = message;
        if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
            let buffer = quoted !== null ? await quoted.download() : await message.download();
            converter
                .ocrScanner(buffer)
                .then(async (data) => {
                    if (data.IsErroredOnProcessing === true || data.ParsedResults[0].ParsedText === "")
                        return Chisato.sendText(from, "*「 ! 」* Can't find Text in Image!", message);
                    await Chisato.sendText(from, data.ParsedResults[0].ParsedText, null, message);
                    buffer = null;
                })
                .catch(async (err) => {
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
};
