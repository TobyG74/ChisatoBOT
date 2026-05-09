import type { ConfigCommands } from "../../types/structure/commands";
import { writeFile, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

export default {
    name: "toimage",
    alias: ["toimg", "stickertoimage", "sti"],
    usage: "",
    category: "converter",
    description: "Convert Sticker to Image/Video/GIF",
    cooldown: 2,
    async run({ Chisato, from, message, prefix }) {
        await Chisato.sendReaction(from, "⏳", message.key);
        
        try {
            let { quoted } = message;
            let buffer: Buffer | null = null;
            let isAnimated = false;

            if (message?.type === "stickerMessage") {
                buffer = await message.download();
                isAnimated = message.message?.stickerMessage?.isAnimated || false;
            } else if (quoted?.type === "stickerMessage") {
                buffer = await quoted.download();
                isAnimated = quoted.message?.stickerMessage?.isAnimated || false;
            } else {
                await Chisato.sendReaction(from, "❌", message.key);
                let text = `*「 STICKER TO MEDIA 」*\n\n`;
                text += `🖼️ Convert sticker back to image, video, or GIF!\n\n`;
                text += `📝 *How to use:*\n`;
                text += `1️⃣ Reply to a sticker with ${prefix}toimage\n`;
                text += `2️⃣ Send sticker with caption ${prefix}toimage\n\n`;
                text += `💡 *Example:*\n`;
                text += `• ${prefix}toimage (reply to sticker)\n\n`;
                text += `✨ Convert your stickers back to media format`;
                await Chisato.sendText(from, text, message);
                return;
            }

            if (!buffer) {
                await Chisato.sendReaction(from, "❌", message.key);
                return Chisato.sendText(
                    from,
                    "❌ Failed to download sticker. Please try again.",
                    message
                );
            }

            const tempDir = join(dirname(fileURLToPath(import.meta.url)), "../../../temp");
            const tempInput = join(tempDir, `sticker_${Date.now()}.webp`);
            const tempOutput = join(tempDir, `output_${Date.now()}.${isAnimated ? "mp4" : "png"}`);

            await writeFile(tempInput, buffer);

            try {
                if (isAnimated) {
                    await execAsync(
                        `ffmpeg -i "${tempInput}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${tempOutput}"`
                    );
                    
                    const videoBuffer = await readFile(tempOutput);
                    await Chisato.sendMessage(from, {
                        video: videoBuffer,
                        caption: "✅ Sticker converted to video!",
                        gifPlayback: true
                    }, { quoted: message });
                } else {
                    await execAsync(`ffmpeg -i "${tempInput}" "${tempOutput}"`);
                    
                    const imageBuffer = await readFile(tempOutput);
                    await Chisato.sendMessage(from, {
                        image: imageBuffer,
                        caption: "✅ Sticker converted to image!"
                    }, { quoted: message });
                }

                await Chisato.sendReaction(from, "✅", message.key);

                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                
            } catch (conversionError) {
                await Chisato.sendReaction(from, "❌", message.key);
                
                if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                
                return Chisato.sendText(
                    from,
                    "❌ Failed to convert sticker. Make sure FFmpeg is installed on the system.",
                    message
                );
            }

        } catch (error: any) {
            await Chisato.sendReaction(from, "❌", message.key);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await Chisato.sendText(
                from,
                `❌ Failed to convert sticker: ${errorMessage}`,
                message
            );
        }
    },
} satisfies ConfigCommands;
