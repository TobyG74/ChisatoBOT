import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import Wrap from "canvas-text-wrapper";
import emojiReg from "emoji-regex";
import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";

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
        const { type = "default", quality = 80 } = options;
        const tempDir = path.join(process.cwd(), "temp");
        
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        try {
            const isVideo = buffer.toString("hex", 0, 4) === "66747970"; 
            
            if (isVideo) {
                return await this.videoToSticker(buffer, type, quality);
            } else {
                return await this.imageToSticker(buffer, type, quality);
            }
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
        const exif = {
            "sticker-pack-id": "com.chisatobot.sticker",
            "sticker-pack-name": pack,
            "sticker-pack-publisher": author,
            "emojis": ["😀", "😃", "😄"]
        };

        return buffer;
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
}
