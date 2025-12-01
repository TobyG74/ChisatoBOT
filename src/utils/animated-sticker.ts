import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";
import Wrap from "canvas-text-wrapper";
import emojiReg from "emoji-regex";
import { exec } from "child_process";

const { CanvasTextWrapper } = Wrap;

export const saveImages = (buffer: Buffer, sequence: number): string => {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const fileName = path.join(tempDir, `animated_images-${sequence}.webp`);
    fs.writeFileSync(fileName, buffer);
    return fileName;
};

export const createSequence = async (images: string[]): Promise<Buffer> => {
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
};

export const loadColorsPalette = (): string[] => {
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
};

export const generateAnimatedText = async (text: string): Promise<Buffer> => {
    const regex = new RegExp(emojiReg(), "g");
    text = text.trim().replace(regex, "");

    const colors = loadColorsPalette();
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

        // @ts-ignore - canvas-text-wrapper expects browser canvas but works with node canvas
        CanvasTextWrapper(canvas, text, {
            font: "82px Arial",
            textAlign: "center",
            verticalAlign: "middle",
            sizeToFill: true
        });

        const buffer = await canvas.encode("webp");
        const saved = saveImages(buffer, i);
        bufferContainer.push(saved);
    }

    return await createSequence(bufferContainer);
};
