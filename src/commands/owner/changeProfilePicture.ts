import type { ConfigCommands } from "../../types/commands";

export default <ConfigCommands>{
    name: "setpicture",
    alias: ["setpp", "changepp"],
    usage: "<reply>",
    category: "owner",
    description: "Change Bot Profile Picture",
    isOwner: true,
    async run({ Chisato, from, prefix, botNumber, command, message }) {
        let buffer: Buffer | null;
        const { quoted } = message;
        if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
            buffer = quoted !== null ? await quoted.download() : await message.download();
            await Chisato.updateProfilePicture(botNumber, buffer)
                .then(() => Chisato.sendText(from, `Successfully changed the bot's profile picture`, message))
                .catch(() => Chisato.sendText(from, `Failed to change bot profile picture`, message));
            buffer = null;
        } else {
            await Chisato.sendText(
                from,
                `Please send or reply to the image with the caption ${prefix + command.name}`,
                message
            );
        }
    },
};
