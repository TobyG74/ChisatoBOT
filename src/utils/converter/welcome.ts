import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import axios from "axios";

export async function createWelcomeImage(
    profileUrl: string,
    username: string,
    groupName: string,
    memberCount: number
): Promise<Buffer> {
    // Canvas size matching welcome.png
    const width = 1024;
    const height = 576;

    // Load background template
    const templatePath = path.join(process.cwd(), "media", "welcome.png");
    const background = await loadImage(templatePath);
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.drawImage(background, 0, 0, width, height);

    // Add simple overlay for better text visibility
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
        
        // Check if profileUrl is a local file or URL
        if (profileUrl.startsWith("http://") || profileUrl.startsWith("https://")) {
            const response = await axios.get(profileUrl, { responseType: "arraybuffer" });
            profileImage = await loadImage(Buffer.from(response.data));
        } else {
            // Load from local file
            profileImage = await loadImage(profileUrl);
        }
        
        // Draw circular profile picture
        const profileSize = 160;
        const profileX = width / 2;
        const profileY = 150;

        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw profile image
        ctx.drawImage(
            profileImage,
            profileX - profileSize / 2,
            profileY - profileSize / 2,
            profileSize,
            profileSize
        );
        ctx.restore();

        // Draw gold border around profile picture
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw outer ring
        ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileSize / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.error("Failed to load profile picture:", error);
        // Draw placeholder circle
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

    // Setup text shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw "WELCOME TO" text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WELCOME TO", width / 2, 260);

    // Draw group name with gold color
    ctx.font = "bold 52px Arial, sans-serif";
    ctx.fillStyle = "#fbbf24";
    
    // Truncate group name if too long
    let displayGroup = groupName;
    if (displayGroup.length > 28) {
        displayGroup = displayGroup.substring(0, 25) + "...";
    }
    
    ctx.fillText(displayGroup, width / 2, 325);

    // Draw decorative dots
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

    // Draw username with lighter color
    ctx.shadowBlur = 8;
    ctx.font = "38px Arial, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    
    // Truncate username if too long
    let displayName = username;
    if (displayName.length > 22) {
        displayName = displayName.substring(0, 19) + "...";
    }
    
    ctx.fillText(displayName, width / 2, 400);
    
    // Draw member count badge with modern style
    const badgeWidth = 180;
    const badgeHeight = 42;
    const badgeX = width / 2 - badgeWidth / 2;
    const badgeY = 445;
    
    // Badge background with rounded corners
    ctx.shadowBlur = 6;
    ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 21);
    ctx.fill();
    
    // Badge border
    ctx.strokeStyle = "rgba(217, 119, 6, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Member count text
    ctx.shadowBlur = 0;
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText(`Member #${memberCount}`, width / 2, 468);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Encode to PNG
    return await canvas.encode("png");
}

export async function createLeaveImage(
    profileUrl: string,
    username: string,
    groupName: string,
    memberCount: number
): Promise<Buffer> {
    // Canvas size matching welcome.png
    const width = 1024;
    const height = 576;

    // Load background template
    const templatePath = path.join(process.cwd(), "media", "welcome.png");
    const background = await loadImage(templatePath);
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Draw background
    ctx.drawImage(background, 0, 0, width, height);

    // Add darker overlay for leave message
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);

    // Draw decorative elements (same as welcome)
    ctx.save();
    ctx.translate(80, 150);
    ctx.rotate(-15 * Math.PI / 180);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.3)"; // Red tone
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

        // Red border for leave
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

    // Setup text shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw "GOODBYE FROM" text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOODBYE FROM", width / 2, 260);

    // Draw group name with red color
    ctx.font = "bold 52px Arial, sans-serif";
    ctx.fillStyle = "#ef4444";
    
    let displayGroup = groupName;
    if (displayGroup.length > 28) {
        displayGroup = displayGroup.substring(0, 25) + "...";
    }
    
    ctx.fillText(displayGroup, width / 2, 325);

    // Draw decorative dots (red)
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

    // Draw username
    ctx.shadowBlur = 8;
    ctx.font = "38px Arial, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    
    let displayName = username;
    if (displayName.length > 22) {
        displayName = displayName.substring(0, 19) + "...";
    }
    
    ctx.fillText(displayName, width / 2, 400);
    
    // Draw member count badge (red theme)
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
