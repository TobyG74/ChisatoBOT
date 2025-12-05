import { createCanvas, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import path from "path";
import axios from "axios";
import { parse as parseEmoji } from "twemoji-parser";
import { parsePhoneNumber } from "awesome-phonenumber";

/**
 * Helper function to draw text with emoji support
 */
async function drawTextWithEmoji(
    ctx: SKRSContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth?: number
): Promise<void> {
    const parsedEmoji = parseEmoji(text);
    
    if (parsedEmoji.length === 0) {
        ctx.fillText(text, x, y, maxWidth);
        return;
    }

    let currentX = x;
    let lastIndex = 0;
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || "16");
    const emojiSize = fontSize;

    if (ctx.textAlign === "center") {
        const textWidth = ctx.measureText(text).width;
        currentX = x - textWidth / 2;
    } else if (ctx.textAlign === "right") {
        const textWidth = ctx.measureText(text).width;
        currentX = x - textWidth;
    }

    for (const emoji of parsedEmoji) {
        if (emoji.indices[0] > lastIndex) {
            const textBefore = text.substring(lastIndex, emoji.indices[0]);
            const savedAlign = ctx.textAlign;
            ctx.textAlign = "left";
            ctx.fillText(textBefore, currentX, y);
            ctx.textAlign = savedAlign;
            currentX += ctx.measureText(textBefore).width;
        }

        try {
            const emojiUrl = emoji.url;
            const response = await axios.get(emojiUrl, { responseType: "arraybuffer" });
            const emojiImage = await loadImage(Buffer.from(response.data));
            
            let emojiY = y;
            if (ctx.textBaseline === "top") {
                emojiY = y;
            } else if (ctx.textBaseline === "middle") {
                emojiY = y - emojiSize / 2;
            } else if (ctx.textBaseline === "bottom") {
                emojiY = y - emojiSize;
            } else {
                emojiY = y - emojiSize * 0.85;
            }
            
            ctx.drawImage(emojiImage, currentX, emojiY, emojiSize, emojiSize);
            currentX += emojiSize;
        } catch (error) {
            const emojiText = emoji.text;
            const savedAlign = ctx.textAlign;
            ctx.textAlign = "left";
            ctx.fillText(emojiText, currentX, y);
            ctx.textAlign = savedAlign;
            currentX += ctx.measureText(emojiText).width;
        }

        lastIndex = emoji.indices[1];
    }

    if (lastIndex < text.length) {
        const textAfter = text.substring(lastIndex);
        const savedAlign = ctx.textAlign;
        ctx.textAlign = "left";
        ctx.fillText(textAfter, currentX, y);
        ctx.textAlign = savedAlign;
    }
}

export async function createWelcomeImage(
    profileUrl: string,
    phoneNumber: string,
    groupName: string,
    memberCount: number
): Promise<Buffer> {
    const width = 1024;
    const height = 576;

    const templatePath = path.join(process.cwd(), "media", "welcome.png");
    const background = await loadImage(templatePath);
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, width, height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Draw decorative plus signs on left side
    ctx.save();
    ctx.translate(80, 150);
    ctx.rotate(-15 * Math.PI / 180);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(120, 400);
    ctx.rotate(20 * Math.PI / 180);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.moveTo(0, -25);
    ctx.lineTo(0, 25);
    ctx.stroke();
    ctx.restore();

    // Draw decorative X signs on right side
    ctx.save();
    ctx.translate(920, 180);
    ctx.rotate(15 * Math.PI / 180);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-30, -30);
    ctx.lineTo(30, 30);
    ctx.moveTo(30, -30);
    ctx.lineTo(-30, 30);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(880, 420);
    ctx.rotate(-20 * Math.PI / 180);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-35, -35);
    ctx.lineTo(35, 35);
    ctx.moveTo(35, -35);
    ctx.lineTo(-35, 35);
    ctx.stroke();
    ctx.restore();

    // Load and draw profile picture
    try {
        let profileImage;
        
        if (profileUrl.startsWith("http://") || profileUrl.startsWith("https://")) {
            const response = await axios.get(profileUrl, { responseType: "arraybuffer" });
            profileImage = await loadImage(Buffer.from(response.data));
        } else {
            profileImage = await loadImage(profileUrl);
        }
        
        const profileSize = 160;
        const profileX = width / 2;
        const profileY = 150;

        ctx.save();
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
            profileImage,
            profileX - profileSize / 2,
            profileY - profileSize / 2,
            profileSize,
            profileSize
        );
        ctx.restore();

        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.error("Failed to load profile picture:", error);
        const profileSize = 160;
        const profileX = width / 2;
        const profileY = 150;
        
        ctx.fillStyle = "#4a5568";
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WELCOME TO", width / 2, 260);

    ctx.font = "bold 52px Arial, sans-serif";
    ctx.fillStyle = "#fbbf24";
    
    let displayGroup = groupName;
    if (displayGroup.length > 28) {
        displayGroup = displayGroup.substring(0, 25) + "...";
    }
    
    await drawTextWithEmoji(ctx, displayGroup, width / 2, 325);

    ctx.fillStyle = "#fbbf24";
    const dotY = 360;
    ctx.beginPath();
    ctx.arc(width / 2 - 60, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 - 40, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 - 20, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 20, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 40, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 60, dotY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 8;
    ctx.font = "38px Arial, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    
    let displayName = (parsePhoneNumber("+" + phoneNumber)).number.international
    
    await drawTextWithEmoji(ctx, displayName, width / 2, 400);
    
    const badgeWidth = 180;
    const badgeHeight = 42;
    const badgeX = width / 2 - badgeWidth / 2;
    const badgeY = 445;
    
    ctx.shadowBlur = 6;
    ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 21);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(217, 119, 6, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText(`Member #${memberCount}`, width / 2, 468);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    return await canvas.encode("png");
}

export async function createLeaveImage(
    profileUrl: string,
    phoneNumber: string,
    groupName: string,
    memberCount: number
): Promise<Buffer> {
    const width = 1024;
    const height = 576;

    const templatePath = path.join(process.cwd(), "media", "welcome.png");
    const background = await loadImage(templatePath);
    
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, width, height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(80, 150);
    ctx.rotate(-15 * Math.PI / 180);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)"; 
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(20, 0);
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(120, 400);
    ctx.rotate(20 * Math.PI / 180);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.moveTo(0, -25);
    ctx.lineTo(0, 25);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(920, 180);
    ctx.rotate(15 * Math.PI / 180);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-30, -30);
    ctx.lineTo(30, 30);
    ctx.moveTo(30, -30);
    ctx.lineTo(-30, 30);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(880, 420);
    ctx.rotate(-20 * Math.PI / 180);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-35, -35);
    ctx.lineTo(35, 35);
    ctx.moveTo(35, -35);
    ctx.lineTo(-35, 35);
    ctx.stroke();
    ctx.restore();

    try {
        let profileImage;
        
        if (profileUrl.startsWith("http://") || profileUrl.startsWith("https://")) {
            const response = await axios.get(profileUrl, { responseType: "arraybuffer" });
            profileImage = await loadImage(Buffer.from(response.data));
        } else {
            profileImage = await loadImage(profileUrl);
        }
        
        const profileSize = 160;
        const profileX = width / 2;
        const profileY = 150;

        ctx.save();
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
            profileImage,
            profileX - profileSize / 2,
            profileY - profileSize / 2,
            profileSize,
            profileSize
        );
        ctx.restore();

        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.error("Failed to load profile picture:", error);
        const profileSize = 160;
        const profileX = width / 2;
        const profileY = 150;
        
        ctx.fillStyle = "#4a5568";
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOODBYE FROM", width / 2, 260);

    ctx.font = "bold 52px Arial, sans-serif";
    ctx.fillStyle = "#ef4444";
    
    let displayGroup = groupName;
    if (displayGroup.length > 28) {
        displayGroup = displayGroup.substring(0, 25) + "...";
    }
    
    await drawTextWithEmoji(ctx, displayGroup, width / 2, 325);

    ctx.fillStyle = "#ef4444";
    const dotY = 360;
    ctx.beginPath();
    ctx.arc(width / 2 - 60, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 - 40, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 - 20, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 20, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 40, dotY, 3, 0, Math.PI * 2);
    ctx.arc(width / 2 + 60, dotY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 8;
    ctx.font = "38px Arial, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    
    let displayName = (parsePhoneNumber("+" + phoneNumber)).number.international
    
    await drawTextWithEmoji(ctx, displayName, width / 2, 400);
    
    const badgeWidth = 180;
    const badgeHeight = 42;
    const badgeX = width / 2 - badgeWidth / 2;
    const badgeY = 445;
    
    ctx.shadowBlur = 6;
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 21);
    ctx.fill();
    
    ctx.strokeStyle = "rgba(185, 28, 28, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Member #${memberCount}`, width / 2, 468);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    return await canvas.encode("png");
}
