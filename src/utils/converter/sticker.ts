import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import Wrap from "canvas-text-wrapper";
import emojiReg from "emoji-regex";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import webpmux from "node-webpmux";
import Axios from "axios";

const { CanvasTextWrapper } = Wrap;
const execAsync = promisify(exec);

export type StickerType = "default" | "full" | "circle" | "rounded" | "crop";

/**
 * StickerGenerator - Utility class for generating stickers from text and images
 */
export class StickerGenerator {
    /**
     * Generate animated text sticker with rainbow colors
     * @param text - Text to convert to animated sticker
     * @returns Buffer of animated webp sticker
     */
    static async generateAnimatedText(text: string): Promise<Buffer> {
        const regex = new RegExp(emojiReg(), "g");
        text = text.trim().replace(regex, "");

        const colors = this.loadColorsPalette();
        const bufferContainer: string[] = [];

        for (let i = 0; i < colors.length; i++) {
            const canvas = createCanvas(500, 500);
            const ctx = canvas.getContext("2d");

            const color = colors[i].startsWith("#") ? colors[i] : `#${colors[i]}`;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.shadowColor = color;
            ctx.shadowBlur = 2;

            CanvasTextWrapper(canvas as any, text, {
                font: "82px Arial",
                textAlign: "center",
                verticalAlign: "middle",
                sizeToFill: true
            });

            const buffer = await canvas.encode("webp");
            const saved = this.saveImages(buffer, i);
            bufferContainer.push(saved);
        }

        return await this.createSequence(bufferContainer);
    }

    /**
     * Generate static text sticker
     * @param text - Text to convert to sticker
     * @returns Buffer of PNG image
     */
    static async generateTextSticker(text: string): Promise<Buffer> {
        const width = 512;
        const height = 512;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Background
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);

        // Text
        const baseFontSize = 100;
        const fontSize = Math.min(baseFontSize, Math.floor(width / (text.length * 0.6)));
        
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(text, width / 2, height / 2);

        return await canvas.encode("png");
    }

    /**
     * Generate meme image with top and bottom text
     * @param imageBuffer - Original image buffer
     * @param topText - Text for top of image
     * @param bottomText - Text for bottom of image (optional)
     * @returns Buffer of PNG image with meme text
     */
    static async generateMeme(
        imageBuffer: Buffer,
        topText: string,
        bottomText?: string
    ): Promise<Buffer> {
        const image = await loadImage(imageBuffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");

        ctx.drawImage(image, 0, 0);

        const fontSize = Math.floor(image.width / 10);
        ctx.font = `bold ${fontSize}px Impact, Arial`;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = Math.floor(fontSize / 15);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const wrapText = (text: string, maxWidth: number): string[] => {
            const words = text.split(" ");
            const lines: string[] = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        if (topText) {
            const topLines = wrapText(topText.toUpperCase(), image.width - 20);
            const topY = 10;
            topLines.forEach((line, index) => {
                const y = topY + index * fontSize;
                ctx.strokeText(line, image.width / 2, y);
                ctx.fillText(line, image.width / 2, y);
            });
        }

        if (bottomText) {
            const bottomLines = wrapText(bottomText.toUpperCase(), image.width - 20);
            const bottomY = image.height - (bottomLines.length * fontSize) - 10;
            bottomLines.forEach((line, index) => {
                const y = bottomY + index * fontSize;
                ctx.strokeText(line, image.width / 2, y);
                ctx.fillText(line, image.width / 2, y);
            });
        }

        return await canvas.encode("png");
    }

    /**
     * Convert image/video buffer to WebP sticker format
     * @param buffer - Image or video buffer
     * @param options - Sticker options
     * @returns Buffer of WebP sticker
     */
    static async createSticker(
        buffer: Buffer,
        options: {
            type?: StickerType;
            pack?: string;
            author?: string;
            quality?: number;
        } = {}
    ): Promise<Buffer> {
        const { type = "default", pack = "ChisatoBOT", author = "TobyG74", quality = 80 } = options;
        const tempDir = path.join(process.cwd(), "temp");
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const isVideo = buffer.toString("hex", 0, 4) === "66747970"; 
            
            let stickerBuffer: Buffer;
            if (isVideo) {
                stickerBuffer = await this.videoToSticker(buffer, type, quality);
            } else {
                stickerBuffer = await this.imageToSticker(buffer, type, quality);
            }
            
            return await this.addMetadata(stickerBuffer, pack, author);
        } catch (error) {
            throw new Error(`Failed to create sticker: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Convert image to WebP sticker
     * @param buffer - Image buffer
     * @param type - Sticker type
     * @param quality - Image quality
     * @returns Buffer of WebP sticker
     */
    private static async imageToSticker(
        buffer: Buffer,
        type: StickerType,
        quality: number
    ): Promise<Buffer> {
        let image = sharp(buffer);
        const metadata = await image.metadata();

        if (type === "circle" || type === "rounded") {
            const size = 512;
            
            const circle = Buffer.from(
                `<svg width="${size}" height="${size}">
                    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
                </svg>`
            );

            image = image
                .resize(size, size, { fit: "cover" })
                .composite([
                    {
                        input: circle,
                        blend: "dest-in"
                    }
                ]);
        } else if (type === "full") {
            image = image.resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
        } else {
            const size = Math.min(metadata.width || 512, metadata.height || 512);
            image = image.resize(512, 512, { fit: "cover" });
        }

        return await image
            .webp({ quality })
            .toBuffer();
    }

    /**
     * Convert video to animated WebP sticker
     * @param buffer - Video buffer
     * @param type - Sticker type
     * @param quality - Video quality
     * @returns Buffer of animated WebP sticker
     */
    private static async videoToSticker(
        buffer: Buffer,
        type: StickerType,
        quality: number
    ): Promise<Buffer> {
        const tempDir = path.join(process.cwd(), "temp");
        const tempInput = path.join(tempDir, `video_input_${Date.now()}.mp4`);
        const tempOutput = path.join(tempDir, `sticker_output_${Date.now()}.webp`);

        try {
            fs.writeFileSync(tempInput, buffer);

            let scale = "512:512";
            let crop = "";

            if (type === "circle" || type === "rounded") {
                crop = "-vf \"crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,format=rgba,geq=lum='p(X,Y)':a='if(gt(abs(W/2-X),W/2)||gt(abs(H/2-Y),H/2),0,255)'\"";
            } else if (type === "full") {
                scale = "512:512:force_original_aspect_ratio=decrease";
                crop = `-vf "scale=${scale},pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"`;
            } else {
                crop = `-vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512"`;
            }

            const command = `ffmpeg -i "${tempInput}" ${crop} -vcodec libwebp -lossless 0 -q:v ${quality} -loop 0 -preset default -an -vsync 0 "${tempOutput}"`;
            
            await execAsync(command);

            const result = fs.readFileSync(tempOutput);

            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);

            return result;
        } catch (error) {
            if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            throw error;
        }
    }

    /**
     * Add EXIF metadata to WebP sticker
     * @param buffer - WebP buffer
     * @param pack - Pack name
     * @param author - Author name
     * @returns Buffer with EXIF metadata
     */
    static async addMetadata(buffer: Buffer, pack: string, author: string): Promise<Buffer> {
        try {
            const data: Record<string, string> = {};

            data['sticker-pack-id'] = 'com.chisatobot.sticker';
            data['sticker-pack-name'] = pack || 'ChisatoBOT';
            data['sticker-pack-publisher'] = author || 'TobyG74';

            const exif = Buffer.concat([
                Buffer.from([
                    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00,
                    0x00, 0x00
                ]),
                Buffer.from(JSON.stringify(data), 'utf-8')
            ]);

            exif.writeUIntLE(Buffer.from(JSON.stringify(data), 'utf-8').length, 14, 4);

            const img = new webpmux.Image();
            await img.load(buffer);
            img.exif = exif;

            return await img.save(null);
        } catch (error) {
            console.error('Failed to add metadata:', error);
            return buffer;
        }
    }

    /**
     * Save temporary image for animated sticker creation
     * @param buffer - Image buffer
     * @param sequence - Sequence number
     * @returns Path to saved file
     */
    private static saveImages(buffer: Buffer, sequence: number): string {
        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const fileName = path.join(tempDir, `animated_images-${sequence}.webp`);
        fs.writeFileSync(fileName, buffer);
        return fileName;
    }

    /**
     * Create animated webp from sequence of images
     * @param images - Array of image paths
     * @returns Buffer of animated webp
     */
    private static async createSequence(images: string[]): Promise<Buffer> {
        const pathResults = path.join(process.cwd(), "temp", `animated_images-${Date.now()}`);

        return new Promise((resolve, reject) => {
            exec(
                `img2webp -loop 0 ${images.map((v) => `"${v}"`).join(" ")} -o "${pathResults}.webp"`,
                (err) => {
                    if (err) {
                        console.error("Failed to convert to animated webp:", err);
                        reject(err);
                        return;
                    }

                    const buffer = fs.readFileSync(`${pathResults}.webp`);
                    fs.unlinkSync(`${pathResults}.webp`);

                    for (const imgPath of images) {
                        fs.unlinkSync(imgPath);
                    }

                    resolve(buffer);
                }
            );
        });
    }

    /**
     * Load random color palette for animated text
     * @returns Array of color hex codes
     */
    private static loadColorsPalette(): string[] {
        const defaultColors = [
            ["047af6", "7401df", "202532", "32fa00", "ff00d5"],
            ["4db1c3", "046084", "35b07e", "f0a7aa", "e74758"],
            ["ffffff", "f7a9ef", "f881ec", "f751e6", "c400b0"],
            ["ffaf39", "ee7e1b", "ef421b", "cf214b", "bf1679"],
            ["86ff5d", "34e361", "14d285", "0ebb9b", "0c9ea9"],
            ["e0f4ff", "cbecff", "afe2ff", "afd5ff", "afc8ff"],
            ["d2dbde", "8debff", "84b7ff", "b8b8b8", "08e1ff"],
            ["ffef2b", "2f4af4", "ee1c62", "33ee87", "6cfcff"],
            ["6500ff", "ffe04e", "8b00ff", "bd93ed", "7400ff"]
        ];

        return defaultColors[Math.floor(Math.random() * defaultColors.length)];
    }

    /**
     * Generate WhatsApp-style bubble chat sticker from quote
     * @param profilePicUrl - URL or path to profile picture
     * @param senderName - Name of the sender
     * @param message - Message text
     * @returns Buffer of PNG image
     */
    static async generateBubbleChatSticker(
        profilePicUrl: string,
        senderName: string,
        message: string
    ): Promise<Buffer> {
        const canvasSize = 512;
        const canvas = createCanvas(canvasSize, canvasSize);
        const ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvasSize, canvasSize);

        const avatarSize = 50;
        const avatarX = 20;
        const avatarY = 50;

        const padding = 20;
        const lineHeight = 24;
        const maxBubbleWidth = canvasSize - avatarX - avatarSize - 40;
        
        ctx.font = "bold 18px Arial, sans-serif";
        const nameWidth = ctx.measureText(senderName).width;
        
        ctx.font = "16px Arial, sans-serif";
        const wrappedText = this.wrapText(ctx, message, maxBubbleWidth - (padding * 2));
        
        let maxTextWidth = nameWidth;
        for (const line of wrappedText) {
            const lineWidth = ctx.measureText(line).width;
            if (lineWidth > maxTextWidth) {
                maxTextWidth = lineWidth;
            }
        }
        
        const bubbleWidth = Math.min(maxTextWidth + (padding * 2), maxBubbleWidth);
        const bubbleHeight = 40 + (wrappedText.length * lineHeight) + padding;

        const bubbleX = avatarX + avatarSize + 15;
        const bubbleY = avatarY - 15;

        // Draw WhatsApp bubble 
        ctx.fillStyle = "#DCF8C6";
        ctx.strokeStyle = "#B5E3A0";
        ctx.lineWidth = 2;
        
        // Rounded rectangle for bubble
        const radius = 10;
        ctx.beginPath();
        ctx.moveTo(bubbleX + radius, bubbleY);
        ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
        ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
        ctx.lineTo(bubbleX, bubbleY + radius);
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw bubble tail (triangle pointing to avatar)
        ctx.beginPath();
        ctx.moveTo(bubbleX, bubbleY + 20);
        ctx.lineTo(bubbleX - 10, bubbleY + 15);
        ctx.lineTo(bubbleX, bubbleY + 30);
        ctx.closePath();
        ctx.fillStyle = "#DCF8C6";
        ctx.fill();
        ctx.strokeStyle = "#B5E3A0";
        ctx.stroke();

        // Draw sender name (bold)
        ctx.fillStyle = "#075E54";
        ctx.font = "bold 18px Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(senderName, bubbleX + padding, bubbleY + 15);

        // Draw message text
        ctx.fillStyle = "#000000";
        ctx.font = "16px Arial, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        let textY = bubbleY + 40;
        for (const line of wrappedText) {
            ctx.fillText(line, bubbleX + padding, textY);
            textY += lineHeight;
        }

        // Draw profile picture (circular)
        try {
            const response = await Axios.get(profilePicUrl, { responseType: "arraybuffer" });
            const avatarImage = await loadImage(Buffer.from(response.data));

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // Draw avatar border
            ctx.strokeStyle = "#075E54";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (error) {
            // Draw default avatar circle if image fails to load
            ctx.fillStyle = "#075E54";
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw user icon
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "bold 30px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("👤", avatarX + avatarSize / 2, avatarY + avatarSize / 2);
        }

        return await canvas.encode("png");
    }

    /**
     * Wrap text to fit within specified width
     * @param ctx - Canvas context
     * @param text - Text to wrap
     * @param maxWidth - Maximum width
     * @returns Array of wrapped lines
     */
    private static wrapText(ctx: any, text: string, maxWidth: number): string[] {
        const lines: string[] = [];
        
        // Split by newlines first to preserve intentional line breaks
        const paragraphs = text.split('\n');
        
        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) {
                lines.push('');
                continue;
            }
            
            const words = paragraph.split(' ');
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                lines.push(currentLine);
            }
        }

        // Limit to reasonable number of lines for sticker
        if (lines.length > 20) {
            return [...lines.slice(0, 19), '...'];
        }
        
        return lines;
    }

    /**
     * Mix two emojis to create a combined emoji sticker
     * @param emoji1 - First emoji
     * @param emoji2 - Second emoji
     * @returns Promise with URL of mixed emoji or error
     */
    static async emojiMix(emoji1: string, emoji2: string): Promise<{ url?: string; error?: boolean; message?: string }> {
        try {
            const response = await Axios.get(
                `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(
                    emoji1
                )}_${encodeURIComponent(emoji2)}`
            );

            if (response.data.results.length === 0) {
                return {
                    error: true,
                    message: `${emoji1} and ${emoji2} cannot be combined! Try different emojis...`,
                };
            }

            return { url: response.data.results[0].url };
        } catch (error) {
            throw new Error(`Failed to mix emojis: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

