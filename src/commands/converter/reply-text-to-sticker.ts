import type { ConfigCommands } from "../../types/structure/commands";
import { StickerGenerator } from "../../utils/converter/sticker";
import fs from "fs";
import path from "path";
import { parsePhoneNumber } from 'awesome-phonenumber';

export default {
    name: "replytexttosticker",
    alias: ["replytsticker", "rts", "quotesticker"],
    usage: "[Reply to a message]",
    category: "converter",
    description: "Convert reply text message to WhatsApp bubble chat sticker",
    cooldown: 3,
    async run({ Chisato, from, message, isGroup }) {
        await Chisato.sendReaction(from, "⏳", message.key);

        try {
            if (!message.quoted) {
                await Chisato.sendReaction(from, "❌", message.key);
                return await Chisato.sendText(
                    from,
                    "❌ Please reply to a message to convert it to sticker!",
                    message
                );
            }

            if (message.quoted.type !== "conversation" && message.quoted.type !== "extendedTextMessage") {
                await Chisato.sendReaction(from, "❌", message.key);
                return await Chisato.sendText(
                    from,
                    "❌ Please reply to a text message to convert it to sticker!",
                    message
                );
            }

            let quotedSender;
            if (isGroup) {
                quotedSender = parsePhoneNumber("+" + (await Chisato.groupMetadata(from).then((meta) => {
                    const participant = meta.participants.find(
                        (p: any) => p.id === message.quoted!.sender
                    );
                    return participant ? participant.phoneNumber : message.quoted!.sender;
                })).split("@")[0]).number.international;
            } else {
                quotedSender = parsePhoneNumber("+" + message.quoted!.sender.split("@")[0]).number.international;
            }

            const quotedMessage = message.quoted.body || "Media Message";

            let profilePicUrl = "https://i.imgur.com/7k12EPD.png"; 
            try {
                const ppUrl = await Chisato.profilePictureUrl(message.quoted.sender, "image");
                if (ppUrl) profilePicUrl = ppUrl;
            } catch (error) {
                const ppUrl = path.join(process.cwd(), "media", "noprofile.png");
                profilePicUrl = ppUrl;
            }

            const imageBuffer = await StickerGenerator.generateBubbleChatSticker(
                profilePicUrl,
                quotedSender,
                quotedMessage
            );

            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

            await Chisato.sendMediaAsSticker(
                from,
                { pack: stickers.packname, author: stickers.author },
                imageBuffer,
                "default",
                message
            );

            await Chisato.sendReaction(from, "✅", message.key);
        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to create sticker: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;