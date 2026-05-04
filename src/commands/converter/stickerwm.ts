import type { ConfigCommands } from "../../types/structure/commands";
import { StickerType } from "../../utils/converter/sticker";

export default {
    name: "stickerwm",
    alias: ["swm", "stikerwm", "takestick"],
    usage: "<pack name>|<author name> [option]",
    category: "converter",
    description: "Convert Image / Video to Sticker with custom watermark (Premium Only)",
    cooldown: 2,
    limit: 1,
    isPremium: true,
    async run({ Chisato, args, from, message, prefix }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        try {
            let { quoted } = message;
            
            const watermarkText = args.join(" ");
            let packName = "ChisatoBOT";
            let authorName = "TobyG74";
            let type: StickerType = "default";

            if (watermarkText.includes("|")) {
                const parts = watermarkText.split("|");
                
                const lastPart = parts[parts.length - 1].trim().toLowerCase();
                const validTypes: StickerType[] = ["default", "full", "circle", "rounded", "crop"];
                
                if (validTypes.includes(lastPart as StickerType)) {
                    type = lastPart as StickerType;
                    parts.pop();
                }

                if (parts.length >= 2) {
                    packName = parts[0].trim();
                    authorName = parts.slice(1).join("|").trim();
                } else if (parts.length === 1) {
                    packName = parts[0].trim();
                }
            } else {
                const words = watermarkText.split(" ");
                const lastWord = words[words.length - 1].toLowerCase();
                const validTypes: StickerType[] = ["default", "full", "circle", "rounded", "crop"];
                
                if (validTypes.includes(lastWord as StickerType)) {
                    type = lastWord as StickerType;
                    packName = words.slice(0, -1).join(" ");
                } else {
                    packName = watermarkText;
                }
            }

            if (packName.length > 50) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Pack name is too long! Maximum 50 characters.",
                    message
                );
            }

            if (authorName.length > 50) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Author name is too long! Maximum 50 characters.",
                    message
                );
            }

            let buffer: Buffer | null;

            if (message?.type === "imageMessage" || quoted?.type === "imageMessage") {
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: packName, author: authorName },
                    buffer,
                    type,
                    false,
                    message
                );
                buffer = null;
            } else if (message?.type === "videoMessage" || quoted?.type === "videoMessage") {
                const seconds =
                    quoted !== null ? quoted.message[quoted.type].seconds : message.message[message.type].seconds;
                if (seconds > 10) {
                    await Chisato.sendReaction(from, "❌", message.key);
                    return Chisato.sendText(
                        from,
                        "❌ Sorry, the video is too long! Maximum 10 seconds.",
                        message
                    );
                }
                buffer = quoted !== null ? await quoted.download() : await message.download();
                await Chisato.sendMediaAsSticker(
                    from,
                    { pack: packName, author: authorName },
                    buffer,
                    type,
                    true,
                    message
                );
                buffer = null;
            } else {
                await Chisato.sendReaction(from, "❌", message.key);
                let text = `*「 CUSTOM STICKER WATERMARK 」*\n\n`;
                text += `🎨 Create sticker with your own watermark! (Premium Only)\n\n`;
                text += `📝 *How to use:*\n`;
                text += `${prefix}stickerwm <pack name>|<author name>\n\n`;
                text += `💡 *Example:*\n`;
                text += `1️⃣ Reply to image/video:\n`;
                text += `   ${prefix}stickerwm My Pack|My Name\n\n`;
                text += `2️⃣ Send image/video with caption:\n`;
                text += `   ${prefix}stickerwm My Sticker|@username\n\n`;
                text += `3️⃣ Add sticker type option:\n`;
                text += `   ${prefix}stickerwm My Pack|Author full\n`;
                text += `   ${prefix}stickerwm My Pack|Author circle\n\n`;
                text += `📋 *Sticker Types:*\n`;
                text += `• default - Standard crop\n`;
                text += `• full - Full size with transparent background\n`;
                text += `• circle - Circular crop\n`;
                text += `• rounded - Rounded corners\n\n`;
                text += `⚠️ *Note:*\n`;
                text += `• Video maximum 10 seconds\n`;
                text += `• Use | (pipe) to separate pack and author\n`;
                text += `✨ Premium Feature`;
                await Chisato.sendText(from, text, message);
                return Chisato.sendText(
                    from,
                    `❌ Please reply to an image or video!\n\nUsage: ${prefix}stickerwm <pack>|<author>`,
                    message
                );
            }

            await Chisato.sendReaction(from, "✅", message.key);

            const infoText = `✅ *Sticker created!*\n\n📦 Pack: ${packName}\n✍️ Author: ${authorName}\n🎨 Type: ${type}`;
            await Chisato.sendText(from, infoText, message);

        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to convert to sticker. Please try again.\n\nError: ${errorMessage}`,
                message
            );
            Chisato.logger.error("Error converting to sticker:", error);
        }
    },
} satisfies ConfigCommands;
