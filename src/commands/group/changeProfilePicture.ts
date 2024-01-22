import fs from "fs";
import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "grouppicture",
    alias: ["gpicture"],
    usage: "<reply>",
    category: "group",
    description: "Change Group Profile Picture.",
    isGroup: true,
    isGroupAdmin: true,
    async run({ Chisato, from, message }) {
        let buffer: Buffer | null;
        const { quoted } = message;
        if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
            buffer = quoted !== null ? await quoted.download() : await message.download();
            await Chisato.updateProfilePicture(from, buffer)
                .then(() => Chisato.sendText(from, "Successfully changed group profile picture!", message))
                .catch(() => Chisato.sendText(from, "Failed to change group profile picture!", message));
        } else {
            Chisato.sendText(
                from,
                "Please send or reply to the image that your want to use as Group Profile Picture!",
                message
            );
        }
    },
};
