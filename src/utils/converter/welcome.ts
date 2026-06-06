import { createCanvas, loadImage, SKRSContext2D, Image } from "@napi-rs/canvas";
import path from "path";
import axios from "axios";
import twemojiParser from "twemoji-parser";
const { parse: parseEmoji } = twemojiParser;
import { parsePhoneNumber } from "awesome-phonenumber";

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 576;

export type LayoutVariant = "welcome" | "leave";

export interface AvatarElement {
    show: boolean;
    x: number;
    y: number;
    size: number;
}

export interface TextElement {
    show: boolean;
    text?: string;
    x: number;
    y: number;
    size: number;
    color: string;
}

export interface LayoutConfig {
    variant: LayoutVariant;
    background: string | null;
    overlayOpacity: number;
    accentColor: string;
    decorations: boolean;
    avatar: AvatarElement;
    title: TextElement;
    groupName: TextElement;
    username: TextElement;
    badge: TextElement;
    caption?: string | null;
}

export function defaultLayoutConfig(variant: LayoutVariant): LayoutConfig {
    const accent = variant === "welcome" ? "#fbbf24" : "#ef4444";
    return {
        variant,
        background: null,
        overlayOpacity: variant === "welcome" ? 0.3 : 0.5,
        accentColor: accent,
        decorations: true,
        avatar: { show: true, x: 512, y: 150, size: 160 },
        title: {
            show: true,
            text: variant === "welcome" ? "WELCOME TO" : "GOODBYE FROM",
            x: 512,
            y: 260,
            size: 48,
            color: "#ffffff",
        },
        groupName: { show: true, x: 512, y: 325, size: 52, color: accent },
        username: { show: true, x: 512, y: 400, size: 38, color: "#e5e7eb" },
        badge: { show: true, x: 512, y: 466, size: 22, color: accent },
        caption: null,
    };
}

/** Deep-merge a stored partial config over the defaults for its variant. */
export function resolveLayoutConfig(
    variant: LayoutVariant,
    stored: unknown
): LayoutConfig {
    const base = defaultLayoutConfig(variant);
    if (!stored || typeof stored !== "object") return base;
    const s = stored as Partial<LayoutConfig>;
    const mergeEl = <T extends object>(def: T, override: unknown): T =>
        override && typeof override === "object"
            ? { ...def, ...(override as object) }
            : def;
    return {
        variant,
        background: typeof s.background === "string" || s.background === null ? s.background ?? null : base.background,
        overlayOpacity:
            typeof s.overlayOpacity === "number"
                ? Math.min(1, Math.max(0, s.overlayOpacity))
                : base.overlayOpacity,
        accentColor: typeof s.accentColor === "string" ? s.accentColor : base.accentColor,
        decorations: typeof s.decorations === "boolean" ? s.decorations : base.decorations,
        avatar: mergeEl(base.avatar, s.avatar),
        title: mergeEl(base.title, s.title),
        groupName: mergeEl(base.groupName, s.groupName),
        username: mergeEl(base.username, s.username),
        badge: mergeEl(base.badge, s.badge),
        caption: typeof s.caption === "string" ? s.caption : base.caption,
    };
}

let cachedDefaultBackground: Image | null = null;
async function getDefaultBackground(): Promise<Image> {
    if (cachedDefaultBackground) return cachedDefaultBackground;
    const templatePath = path.join(process.cwd(), "media", "welcome.png");
    cachedDefaultBackground = await loadImage(templatePath);
    return cachedDefaultBackground;
}

/** image source (path/url) → loaded background image (small LRU). */
const backgroundCache = new Map<string, { img: Image; expiresAt: number }>();
const BG_CACHE_TTL_MS = 5 * 60 * 1000;
const BG_CACHE_MAX = 50;

async function getBackgroundForConfig(background: string | null): Promise<Image> {
    if (!background) return getDefaultBackground();

    const now = Date.now();
    const cached = backgroundCache.get(background);
    if (cached && cached.expiresAt > now) return cached.img;

    try {
        let img: Image;
        if (background.startsWith("http://") || background.startsWith("https://")) {
            const response = await axios.get(background, {
                responseType: "arraybuffer",
                timeout: 5000,
            });
            img = await loadImage(Buffer.from(response.data));
        } else {
            // Public-relative path like /uploads/welcome/xxx.png
            const rel = background.replace(/^\/+/, "");
            const fsPath = path.join(process.cwd(), "public", rel);
            img = await loadImage(fsPath);
        }
        if (backgroundCache.size >= BG_CACHE_MAX) {
            const oldest = backgroundCache.keys().next().value as string | undefined;
            if (oldest) backgroundCache.delete(oldest);
        }
        backgroundCache.set(background, { img, expiresAt: now + BG_CACHE_TTL_MS });
        return img;
    } catch {
        return getDefaultBackground();
    }
}

/** Invalidate a cached custom background after it's been replaced. */
export function invalidateBackgroundCache(background: string | null): void {
    if (background) backgroundCache.delete(background);
}

/** url → loaded twemoji image. Persistent for the process lifetime. */
const emojiImageCache = new Map<string, Image>();
/** url → in-flight load promise (prevents duplicate fetches for the same emoji). */
const emojiImageInflight = new Map<string, Promise<Image | null>>();

/** path/url → loaded profile image (small LRU). */
const profileImageCache = new Map<string, { img: Image; expiresAt: number }>();
const PROFILE_IMG_CACHE_TTL_MS = 5 * 60 * 1000;
const PROFILE_IMG_CACHE_MAX = 100;

async function getProfileImage(profileUrl: string): Promise<Image | null> {
    const now = Date.now();
    const cached = profileImageCache.get(profileUrl);
    if (cached && cached.expiresAt > now) return cached.img;
    try {
        let img: Image;
        if (profileUrl.startsWith("http://") || profileUrl.startsWith("https://")) {
            const response = await axios.get(profileUrl, {
                responseType: "arraybuffer",
                timeout: 3000,
            });
            img = await loadImage(Buffer.from(response.data));
        } else {
            img = await loadImage(profileUrl);
        }
        if (profileImageCache.size >= PROFILE_IMG_CACHE_MAX) {
            // Drop oldest
            const oldestKey = profileImageCache.keys().next().value as string | undefined;
            if (oldestKey) profileImageCache.delete(oldestKey);
        }
        profileImageCache.set(profileUrl, { img, expiresAt: now + PROFILE_IMG_CACHE_TTL_MS });
        return img;
    } catch {
        return null;
    }
}

async function getEmojiImage(url: string): Promise<Image | null> {
    const cached = emojiImageCache.get(url);
    if (cached) return cached;
    const inflight = emojiImageInflight.get(url);
    if (inflight) return inflight;
    const promise = (async () => {
        try {
            const response = await axios.get(url, {
                responseType: "arraybuffer",
                timeout: 4000,
            });
            const img = await loadImage(Buffer.from(response.data));
            emojiImageCache.set(url, img);
            return img;
        } catch {
            return null;
        } finally {
            emojiImageInflight.delete(url);
        }
    })();
    emojiImageInflight.set(url, promise);
    return promise;
}

/**
 * Helper function to draw text with emoji support.
 *
 * Performance: pre-fetches all emoji images concurrently (cached across
 * invocations) before drawing, so a string with N emojis adds at most one
 * round of fast cache hits — not N sequential network requests.
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

    // Warm the emoji cache concurrently. After this `await Promise.all`, the
    // per-emoji loop below should be hitting cache hits only.
    const emojiImages = await Promise.all(parsedEmoji.map((e) => getEmojiImage(e.url)));

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

    for (let i = 0; i < parsedEmoji.length; i++) {
        const emoji = parsedEmoji[i];
        const emojiImage = emojiImages[i];

        if (emoji.indices[0] > lastIndex) {
            const textBefore = text.substring(lastIndex, emoji.indices[0]);
            const savedAlign = ctx.textAlign;
            ctx.textAlign = "left";
            ctx.fillText(textBefore, currentX, y);
            ctx.textAlign = savedAlign;
            currentX += ctx.measureText(textBefore).width;
        }

        if (emojiImage) {
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
        } else {
            // Network fetch failed and there's no cached image — draw the
            // emoji as plain text so we don't lose anything.
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

/** Draw a small decorative plus or cross mark. */
function drawDecoration(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    rotation: number,
    color: string,
    lineWidth: number,
    half: number,
    cross: boolean
): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    if (cross) {
        ctx.moveTo(-half, -half);
        ctx.lineTo(half, half);
        ctx.moveTo(half, -half);
        ctx.lineTo(-half, half);
    } else {
        ctx.moveTo(-half, 0);
        ctx.lineTo(half, 0);
        ctx.moveTo(0, -half);
        ctx.lineTo(0, half);
    }
    ctx.stroke();
    ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return `rgba(251,191,36,${alpha})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

export interface EventImageData {
    profileUrl: string;
    phoneNumber: string;
    groupName: string;
    memberCount: number;
}

/**
 * Config-driven renderer for both welcome and leave images. The two public
 * wrappers below pre-fill variant defaults and merge any per-group overrides.
 */
async function renderEventImage(
    config: LayoutConfig,
    data: EventImageData
): Promise<Buffer> {
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;

    const background = await getBackgroundForConfig(config.background);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(background, 0, 0, width, height);

    ctx.fillStyle = `rgba(0, 0, 0, ${config.overlayOpacity})`;
    ctx.fillRect(0, 0, width, height);

    if (config.decorations) {
        const c = config.accentColor;
        drawDecoration(ctx, 80, 150, -15, hexToRgba(c, 0.3), 3, 20, false);
        drawDecoration(ctx, 120, 400, 20, hexToRgba(c, 0.4), 4, 25, false);
        drawDecoration(ctx, 920, 180, 15, hexToRgba(c, 0.35), 4, 30, true);
        drawDecoration(ctx, 880, 420, -20, hexToRgba(c, 0.4), 5, 35, true);
    }

    // Avatar
    if (config.avatar.show) {
        const { x: profileX, y: profileY, size: profileSize } = config.avatar;
        try {
            const profileImage = await getProfileImage(data.profileUrl);
            if (!profileImage) throw new Error("profile image unavailable");

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

            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = hexToRgba(config.accentColor, 0.3);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(profileX, profileY, profileSize / 2 + 8, 0, Math.PI * 2);
            ctx.stroke();
        } catch {
            ctx.fillStyle = "#4a5568";
            ctx.beginPath();
            ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = config.accentColor;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(profileX, profileY, profileSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Title (static text)
    if (config.title.show) {
        ctx.fillStyle = config.title.color;
        ctx.font = `bold ${config.title.size}px Arial, sans-serif`;
        ctx.fillText(config.title.text || "", config.title.x, config.title.y);
    }

    // Group name (dynamic)
    if (config.groupName.show) {
        ctx.font = `bold ${config.groupName.size}px Arial, sans-serif`;
        ctx.fillStyle = config.groupName.color;
        let displayGroup = data.groupName || "";
        if (displayGroup.length > 28) displayGroup = displayGroup.substring(0, 25) + "...";
        await drawTextWithEmoji(ctx, displayGroup, config.groupName.x, config.groupName.y);

        // Decorative dot row just under the group name.
        ctx.fillStyle = config.accentColor;
        const dotY = config.groupName.y + 35;
        const cx = config.groupName.x;
        ctx.beginPath();
        for (const dx of [-60, -40, -20, 20, 40, 60]) {
            ctx.arc(cx + dx, dotY, 3, 0, Math.PI * 2);
        }
        ctx.fill();
    }

    // Member name / phone (dynamic)
    if (config.username.show) {
        ctx.shadowBlur = 8;
        ctx.font = `${config.username.size}px Arial, sans-serif`;
        ctx.fillStyle = config.username.color;
        const displayName =
            parsePhoneNumber("+" + data.phoneNumber).number?.international ??
            "+" + data.phoneNumber;
        await drawTextWithEmoji(ctx, displayName, config.username.x, config.username.y);
    }

    // Member badge (dynamic)
    if (config.badge.show) {
        const badgeWidth = 180;
        const badgeHeight = 42;
        const badgeX = config.badge.x - badgeWidth / 2;
        const badgeY = config.badge.y - badgeHeight / 2;

        ctx.shadowBlur = 6;
        ctx.fillStyle = hexToRgba(config.badge.color, 0.85);
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 21);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(config.badge.color, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = "bold 22px Arial, sans-serif";
        ctx.fillStyle = config.variant === "welcome" ? "#1f2937" : "#ffffff";
        ctx.fillText(`Member #${data.memberCount}`, config.badge.x, config.badge.y + 2);
    }

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    return await canvas.encode("png");
}

export async function createWelcomeImage(
    profileUrl: string,
    phoneNumber: string,
    groupName: string,
    memberCount: number,
    storedConfig?: unknown
): Promise<Buffer> {
    const config = resolveLayoutConfig("welcome", storedConfig);
    return renderEventImage(config, { profileUrl, phoneNumber, groupName, memberCount });
}

export async function createLeaveImage(
    profileUrl: string,
    phoneNumber: string,
    groupName: string,
    memberCount: number,
    storedConfig?: unknown
): Promise<Buffer> {
    const config = resolveLayoutConfig("leave", storedConfig);
    return renderEventImage(config, { profileUrl, phoneNumber, groupName, memberCount });
}

/**
 * Render a preview image from an arbitrary (possibly unsaved) config using
 * placeholder member data. Used by the dashboard builder's live preview.
 */
export async function renderLayoutPreview(
    variant: LayoutVariant,
    storedConfig: unknown,
    sample?: Partial<EventImageData>
): Promise<Buffer> {
    const config = resolveLayoutConfig(variant, storedConfig);
    return renderEventImage(config, {
        profileUrl: sample?.profileUrl || "",
        phoneNumber: sample?.phoneNumber || "628123456789",
        groupName: sample?.groupName || "Sample Group",
        memberCount: sample?.memberCount ?? 42,
    });
}
