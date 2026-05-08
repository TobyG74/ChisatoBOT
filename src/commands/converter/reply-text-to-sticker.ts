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
    async run({ Chisato, from, message, isGroup, groupParticipants }) {
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

            let quotedSender: string;
            if (isGroup && groupParticipants) {
                const participant = groupParticipants.find(
                    (p: any) => p.id === message.quoted!.sender
                );
                const rawNumber = (participant?.phoneNumber ?? message.quoted!.sender).split("@")[0];
                quotedSender = parsePhoneNumber("+" + rawNumber).number?.international ?? ("+" + rawNumber);
            } else {
                const rawNumber = message.quoted!.sender.split("@")[0];
                quotedSender = parsePhoneNumber("+" + rawNumber).number?.international ?? ("+" + rawNumber);
            }

            const quotedMessage = message.quoted.body || "Media Message";

            const blankPicPath = path.join(process.cwd(), "media", "blank_profile.png");
            let profilePicData: string | Buffer = fs.readFileSync(blankPicPath);
            try {
                const ppUrl = await Chisato.profilePictureUrl(message.quoted.sender, "image");
                if (ppUrl) profilePicData = ppUrl;
            } catch {
                // keep blank_profile.png fallback
            }

            const imageBuffer = await StickerGenerator.generateBubbleChatSticker(
                profilePicData,
                quotedSender,
                quotedMessage
            );

            const { stickers }: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

            await Chisato.sendMediaAsSticker(
                from,
                { pack: stickers.packname, author: stickers.author },
                imageBuffer,
                "default",
                false,
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