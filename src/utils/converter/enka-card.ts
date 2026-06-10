import { createCanvas, loadImage, Path2D, SKRSContext2D } from "@napi-rs/canvas";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { EnkaCharacter, EnkaUserData } from "../../types/lookup/enka";
import type { HSRCharacter, HSRRelic, HSRUserData } from "../../types/lookup/hsr";
import type { ZZZUserData, ZZZAgent } from "../../types/lookup/zzz";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA = path.resolve(__dirname, "../../../media");
const FONT = "'Segoe UI', 'Microsoft YaHei', sans-serif";

const W = 1500;
const H = 720;
const FOOTER_H = 56;
const CARD_H = H - FOOTER_H; // 664

// Three columns
const COL1_X = 0;
const COL1_W = 430;          // portrait + name + constellations + talents
const COL2_X = COL1_W;       // 430
const COL2_W = 360;          // weapon + stats + set bonus
const COL3_X = COL1_W + COL2_W; // 790
const COL3_W = W - COL3_X;   // 710

const ENKA = "https://enka.network/ui/";

// Helpers
async function loadBg(game: string) {
    const cached = BG_CACHE.get(game);
    if (cached !== undefined) return cached;            // null is also a valid "tried but missing" entry

    const p = path.join(MEDIA, `background_card_${game}.png`);
    if (!fs.existsSync(p)) {
        BG_CACHE.set(game, null);
        return null;
    }
    try {
        const img = await loadImage(fs.readFileSync(p));
        BG_CACHE.set(game, img);
        return img;
    } catch {
        BG_CACHE.set(game, null);
        return null;
    }
}
// Decoded background images are heavy (~1500x720 PNG decode each call); decode
// once per game and reuse for every character card in the same process.
const BG_CACHE = new Map<string, any | null>();

// In-memory buffer cache for remote icons (Enka portraits/weapons/skills/artifacts/pfps).
// 8-character showcase pulls ~128 icons but most are duplicates (set icons,
// awakened weapon icons, footer pfp, etc.). A simple cap-evict cache turns
// repeat lookups into O(1) Map hits.
const ICON_BUF_CACHE = new Map<string, Buffer>();
const ICON_BUF_CACHE_MAX = 400;

async function fetchBuf(url: string): Promise<Buffer | null> {
    const cached = ICON_BUF_CACHE.get(url);
    if (cached) {
        // refresh recency by re-inserting (Map preserves insertion order)
        ICON_BUF_CACHE.delete(url);
        ICON_BUF_CACHE.set(url, cached);
        return cached;
    }
    try {
        const buf = Buffer.from(
            (await axios.get(url, { responseType: "arraybuffer", timeout: 8000 })).data
        );
        // simple LRU eviction
        if (ICON_BUF_CACHE.size >= ICON_BUF_CACHE_MAX) {
            const oldest = ICON_BUF_CACHE.keys().next().value;
            if (oldest !== undefined) ICON_BUF_CACHE.delete(oldest);
        }
        ICON_BUF_CACHE.set(url, buf);
        return buf;
    } catch {
        return null;
    }
}

function clip(s: string, n: number) {
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fitText(ctx: SKRSContext2D, text: string, maxW: number) {
    while (text.length > 1 && ctx.measureText(text).width > maxW) {
        text = text.slice(0, -1);
    }
    return text;
}

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
}

function box(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke?: string,
    lw = 1
) {
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
    }
}

function drawIcon(ctx: SKRSContext2D, img: any, x: number, y: number, s: number, r = 4) {
    ctx.save();
    rr(ctx, x, y, s, s, r);
    ctx.clip();
    ctx.drawImage(img, x, y, s, s);
    ctx.restore();
}

function drawCircleIcon(ctx: SKRSContext2D, img: any, cx: number, cy: number, r: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const s = (r * 2) / Math.max(img.width, img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
}

async function preload(jobs: [string, string][]): Promise<Map<string, any>> {
    const m = new Map<string, any>();
    await Promise.all(
        jobs.map(async ([k, url]) => {
            const buf = await fetchBuf(url);
            if (buf)
                try {
                    m.set(k, await loadImage(buf));
                } catch {
                    /* ignore */
                }
        })
    );
    return m;
}

function stars(n: number) {
    return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
}

// Roll-dot indicator (Enka shows 1-3 dots per substat roll)
function drawRollDots(ctx: SKRSContext2D, x: number, y: number, count: number, color: string) {
    const dotR = 2;
    for (let i = 0; i < Math.min(count, 5); i++) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + i * 6, y, dotR, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Estimate roll count from substat value (heuristic for display only)
function rollCount(name: string, value: string): number {
    const num = parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
    if (!num) return 1;
    if (/HP|ATK|DEF/i.test(name) && !value.includes("%")) {
        // flat HP/ATK/DEF: rolls of ~250/16/19
        if (num > 200) return Math.min(5, Math.max(1, Math.round(num / 200)));
        return Math.min(5, Math.max(1, Math.round(num / 16)));
    }
    // percent stats: roll ~5-7%
    return Math.min(5, Math.max(1, Math.round(num / 5.5)));
}

// Each entry has SVG path d-strings + viewBox (square). Defaults to 14.
type SvgIcon = { paths: string[]; viewBox?: number };

// SVG ICON LIBRARY
// Sources:
//   • Genshin (FIGHT_PROP_*) — extracted from enka.network (14×14)
//   • HSR (Icon*)            — extracted from enka.network (24×24)
//   • ZZZ stat icons         — extracted from enka.network (14×14)
//   • Element icons          — custom 14×14 (Anemo/Ice/FireFrost are official;
//     others designed in matching iconographic style)
const SVG_ICONS: Record<string, SvgIcon> = {
    // Genshin / shared (14×14, official)
    HP: {
        paths: [
            "M3.5 7.654a.98.98 0 0 1 .449-.571c1.51-.85 3.586 2.117 6.544.548 1.927 6.083-8.893 6.247-6.992.023zM7 14c-3.373 0-6.75-2.421-5.134-7.26A18.5 18.5 0 0 1 6.57.213.75.75 0 0 1 7 0a.75.75 0 0 1 .432.212 18.5 18.5 0 0 1 4.705 6.528C13.749 11.579 10.376 14 7 14m.22-12.19A.6.6 0 0 0 7 1.735a.7.7 0 0 0-.22.075C5.07 3.134 2.7 7.092 2.839 9.21A4.02 4.02 0 0 0 7 12.753a4.02 4.02 0 0 0 4.162-3.538c.139-2.123-2.231-6.081-3.942-7.405",
        ],
    },
    ATK: {
        paths: [
            "m7.755 1.651 1.643 1.643 1.928-1.926L11.3.25a.23.23 0 0 1 .228-.22h2.2a.23.23 0 0 1 .228.229c-.121 2.66.556 2.457-1.337 2.4l-1.933 1.925L12.33 6.23a.23.23 0 0 1 0 .322c-1.167 1.208-.775.907-1.892-.106l-7.151 7.147a.46.46 0 0 1-.313.137 21 21 0 0 1-2.954.238 21 21 0 0 1 .238-2.953.45.45 0 0 1 .134-.319l7.146-7.153-.838-.839a.23.23 0 0 1 0-.323l.732-.73a.23.23 0 0 1 .322 0z",
        ],
    },
    DEF: {
        paths: [
            "M13.442.726a.29.29 0 0 0-.175-.268C12.859.286 11.503 0 7 0S1.143.286.735.458a.29.29 0 0 0-.176.269v7.44a.87.87 0 0 0 .125.453c1.579 2.6 5.347 4.855 6.16 5.339a.29.29 0 0 0 .3 0c.79-.482 4.56-2.688 6.169-5.335a.87.87 0 0 0 .127-.455zM7 11.968c.059.013-3.56-2.017-4.824-4.368V1.565s0-.452 4.824-.452z",
        ],
    },
    EM: {
        paths: [
            "m8.076 8.152-.017-.05A4.3 4.3 0 0 0 7.3 6.796a4 4 0 0 0-.325-.346A2.113 2.113 0 1 0 7 2.223a2.144 2.144 0 0 0-1.838 3.18 4.4 4.4 0 0 0-1.2-.168 4.4 4.4 0 0 0-.755.066l-.038.007C1.836-.24 10.7-1.672 10.962 4.342a3.985 3.985 0 0 1-2.886 3.81m3.662-2.137a4 4 0 0 0-.626-.235 4.5 4.5 0 0 1-1.105 1.7h.031a2.113 2.113 0 1 1-2.113 2.113 4 4 0 0 0-.025-.445 3.97 3.97 0 0 0-1.863-2.931l-.19-.11a3.963 3.963 0 1 0 .645 6.535q.122-.102.236-.214L6.7 12.39a4.4 4.4 0 0 1-.891-1.765 2.112 2.112 0 1 1-.883-2.914q.1.05.189.11a2.11 2.11 0 0 1 .942 1.49 2 2 0 0 1 .018.28 3.963 3.963 0 1 0 5.663-3.577z",
        ],
    },
    CRIT: {
        paths: [
            "M14 0 7.256 3.5 1.973 1.465 3.5 6.236 0 14l7.256-3.5 4.771 1.527L10.5 7.256Zm-3.24 3.24L8.88 7.136 9.701 9.7l-2.564-.82-3.898 1.88 1.88-4.17-.82-2.565L7.137 5.12Z",
        ],
    },
    CRIT_DMG: {
        paths: [
            "m0 14 3.5-7.764-1.527-4.772L7.255 3.5 14 0l-3.5 7.255 1.527 4.772L7.255 10.5z",
            "M7.045.19a6.76 6.76 0 0 0-3.326.857l3.613 1.392L10.168.967A6.65 6.65 0 0 0 7.045.189zM1.502 3.073A6.8 6.8 0 0 0 .309 6.947c0 .925.189 1.808.529 2.612l1.601-3.555-.937-2.93zm11.63.998-1.571 3.26 1.076 3.361a6.71 6.71 0 0 0 .496-6.621zm-5.8 7.489-3.11 1.5a6.7 6.7 0 0 0 6.436-.436z",
        ],
    },
    ER: {
        paths: [
            "M3.562 7.002a4.03 4.03 0 0 1 4.045-4.049L7.606.608C4.09.61 1.216 3.487 1.216 7.003Z",
            "M7.607.607v2.344a4.03 4.03 0 0 1 4.047 4.047 4.03 4.03 0 0 1-4.047 4.047 4.03 4.03 0 0 1-3.578-2.17l1.727-.348L1.87 4.123 0 9.689l1.67-.337c.942 2.36 3.251 4.039 5.937 4.039C11.123 13.39 14 10.517 14 7S11.123.607 7.607.607",
        ],
    },
    SHIELD: {
        paths: [
            "M7 0 1.5 2v5c0 3.5 2.5 6.5 5.5 7 3-.5 5.5-3.5 5.5-7V2zm0 2 4 1.5V7c0 2.5-1.7 4.7-4 5.2-2.3-.5-4-2.7-4-5.2V3.5z",
        ],
    },

    // HSR-specific stats (24×24, official)
    SPEED: {
        viewBox: 24,
        paths: [
            "M18.5 10.386c.573-.015 1.14-.555 1.617-.846.186-.114.451-.207.462-.462.01-.237-.195-.484-.283-.693a14 14 0 0 0-.82-1.693c-1.391-2.385-3.339-3.988-6.056-4.517-.585-.113-1.422-.094-2.001.027-.19.039-.447.037-.578.207-.122.156-.078.547-.078.738v3.31c0 .377-.187 1.207.149 1.485.317.262.864.144 1.236.117.776-.057 1.685-.301 2.422-.555 1.155-.398 2.214-.875 3.25-1.524-.001 1.245-.114 2.581.694 3.624a.84.84 0 0 0 .585.295zm-9.886-.79-1.853 1.32 4.41 6.181 1.853-1.32z",
        ],
    },
    EHR: {
        viewBox: 24,
        paths: [
            "M7.777 2.167c-.815.193-1.545.593-2.237 1.054-3.529 2.353-3.59 7.716-.309 10.313 1.558 1.233 3.729 1.58 5.632 1.157a6.7 6.7 0 0 0 1.775-.668c3.458-1.97 3.976-6.704 1.672-9.722-.53-.693-1.45-1.25-2.212-1.633-.834-.416-1.538-.527-2.47-.527-.58 0-1.284-.108-1.85.026Zm6.481 19.185c.552 0 .917-.51 1.389-.759 1.321-.697 2.532-1.615 3.857-2.314.414-.218.815-.485 1.235-.694.16-.081.354-.118.386-.322.049-.316-.192-.48-.373-.695-.369-.434-.738-.854-1.08-1.311-.134-.178-.473-.45-.438-.694.042-.29.671-.553.887-.72.686-.534 1.317-1.132 2.006-1.659.234-.179.645-.327.81-.579.252-.384-.57-.912-.81-1.106-.894-.72-1.726-1.512-2.597-2.263-.296-.254-.547-.61-.874-.823-.558-.364-.966.909-1.144 1.286-.708 1.498-1.564 2.948-2.2 4.475-.146.352-.661 1.006-.475 1.389.294.604.956 1.226 1.427 1.697.189.189.638.494.669.771.04.373-.55.956-.76 1.235-.458.61-.77 1.31-1.207 1.929-.255.358-.66.706-.708 1.157m-1.234-6.21c-.352.117-.752.51-1.08.707-.479.285-1 .518-1.466.822-.285.186-.88.757-1.235.708-.27-.038-.545-.35-.771-.489-.69-.421-1.41-.772-2.083-1.222-.316-.21-.765-.671-1.158-.398-.335.233-.558.614-.861.887-1 .901-1.984 1.883-2.79 2.957-.338.45-.747 1.185-.476 1.775.366.8 1.42 1.003 2.199 1.003h7.792c.274 0 .593.045.848-.077.382-.182.537-.747.759-1.08.522-.783.953-1.627 1.504-2.392.256-.353.72-.857.746-1.312.017-.287-.218-.391-.399-.565-.331-.32-.661-.65-.99-.978-.13-.13-.323-.418-.54-.347Z",
        ],
    },
    ERES: {
        viewBox: 24,
        paths: [
            "M2.073 16.368c0-.626-.247-1.22-.307-1.84-.147-1.508.44-3.365 1.15-4.676 1.815-3.352 5.538-6.45 9.583-6.057 1.263.123 2.556.493 3.68 1.086 1.493.788 2.795 2.034 3.809 3.36 1.244 1.63 1.974 3.65 2.172 5.674.077.8-.154 1.582-.154 2.377.435-.273.48-1.14.703-1.61.437-.926.294-1.857.09-2.837-.417-1.998-1.035-3.944-2.275-5.597-3.039-4.05-8.628-5.794-13.238-3.36-1.577.832-2.834 2.02-3.897 3.437-1.195 1.593-2.016 3.606-2.236 5.597-.1.894-.298 1.74.05 2.606.146.36.337.703.46 1.074.097.288.096.65.41.766m9.43-10.325c-1.863.363-3.364 1.264-4.204 3.042-1.778 3.764 1.822 8.09 5.814 7.258 2.04-.426 3.93-2.194 4.14-4.345.268-2.757-1.427-5.505-4.294-5.903-.47-.065-.98-.144-1.456-.051zM8.819 16.33c-.31.162-.667.632-.92.882-.765.754-1.586 1.536-2.146 2.453-.325.533-.496 1.136.076 1.585.667.52 2.032.255 2.837.255h8.587c.34 0 .698.02.997-.178.617-.413.53-1.095.191-1.662-.353-.591-.88-1.018-1.316-1.533-.49-.578-1.087-1.317-1.712-1.75-.367-.256-.77.098-1.074.293-.503.322-1.03.599-1.533.92-.221.142-.483.41-.767.383-.256-.025-.552-.295-.766-.434-.476-.31-.984-.553-1.457-.87-.27-.18-.643-.53-.997-.344",
        ],
    },
    BREAK_EFFECT: {
        viewBox: 24,
        paths: [
            "m3.153 2.1.436.923 1.55 3.536 3.242 7.457-1.614.077-3.383-.077.461.32 1.23.667 3.537 1.884 1.384.666v.077l-2.46.154-2.538.076c.04.348.403.358.692.474.631.255 1.278.44 1.922.654 2.312.77 4.882 1.025 7.304 1.025.546 0 1.078-.055 1.614-.077.256-.01.619.075.833-.102.224-.185.242-.632.308-.897.224-.895.385-1.776.474-2.691.097-.998.21-2 .307-2.998.162-1.664-.148-3.361-.307-4.998-.065-.664-.121-1.354-.308-1.999h-.153l-.334 1.307-.64 2.537-.41 1.846h-.154l-1.281-3.076-.782-1.922-.474-1.153h-.077v1.307l.077 3.306-.769-.513-1.384-1.153-6.073-4.971-1.46-1.218zM19.53 14.478l-.077.077c.192 1.044.063 2.202-.18 3.229-.12.51-.459 1.034-.512 1.537.474-.012.762-.45 1.076-.769 1.008-1.021 1.476-2.474.385-3.613-.212-.222-.39-.398-.692-.461M3.384 18.937c.321 1.108 1.69 1.916 2.69 2.319 2.12.854 4.722.748 6.92.32.659-.128 1.352-.146 1.999-.333l-.923-.077L11.995 21l-5.69-1.243z",
        ],
    },
    SP_RATIO: {
        viewBox: 24,
        paths: [
            "M16.543 6.034c0-.788.669-1.702.436-2.463a1.07 1.07 0 0 0-.59-.654c-.615-.256-1.35-.381-2.001-.526-.409-.09-.808-.264-1.232-.282-.369-.015-.867-.043-1.154.23-.355.34-.41 1.081-.513 1.54-.047.211-.045.461-.257.59-.193.118-.423-.05-.615-.103-.543-.15-1.466-.526-1.899.052-.257.343-.323.904-.435 1.308-.238.853-.478 1.68-.693 2.54-.613 2.45-1.39 4.861-2.001 7.311-.2.797-.417 1.59-.616 2.386-.09.363-.255.802-.026 1.154.283.434.747.482 1.206.603.927.245 1.842.5 2.77.731 1.392.348 2.765.768 4.156 1.116.504.126 1.1.54 1.617.206.486-.315.515-.842.64-1.347.25-.996.472-2.025.77-3.002a153 153 0 0 0 2.117-7.619c.154-.616.33-1.236.5-1.847.083-.3.201-.607.103-.924-.232-.748-1.616-.947-2.283-1M3.92 16.962l.54-2.462-.154-1.617.256-2.077.77-1.847 1.027-1.463.718-2.463c-.718 0-1.491.864-1.95 1.373-1.26 1.397-2.177 3.205-2.36 5.092-.066.678 0 1.397 0 2.078 0 .878.228 1.717.513 2.54.124.357.232.835.641.846ZM15.158 7.42l-.514 1.232-1.193 2.462-.474.924.41.41 1.309.898.36.385-.437.36-1.309.73-4.079 2.31-1.77.91.822-1.078 1.795-2.154.872-1.078-.41-.436-1.232-.808-.294-.372.371-.36 1.155-.846 3.31-2.552zm4.925 1.078-.18.846-.436 1.694.154 1.539-.256 2.078-1 2.232-.822 1.09-.256 1.141-.436 1.386c.477 0 .645-.227 1-.513.579-.467 1.033-.978 1.488-1.565 2.227-2.876 2.511-6.702.898-9.928z",
        ],
    },

    // ZZZ-specific stats (14×14, official)
    IMPACT: {
        paths: [
            "m.336.336 4.613 7.688-2.563.768 2.819 1.794-4.613 3.075h7.944c1.506 0 2.923.11 4.079-1.046s1.046-2.573 1.046-4.079V.592c-1.236 1.654-2.164 3.17-3.075 4.613L9.17 2.32 8.024 4.95zm6.919 6.663 2.819 1.793 1.281-1.537c0 1.153.26 2.724-.69 3.507-.949.783-2.443.575-3.41.593l1.537-1.281z",
        ],
    },
    PEN_DELTA: {
        paths: [
            "M9.388.105 6.81 2.795.47.56l2.382 6.2L.195 9.38l9.646.275Zm1.558 3.289.134 2.833c.428.6.66 1.318.66 2.056a3.547 3.547 0 0 1-3.547 3.547 3.55 3.55 0 0 1-2.33-.875l-2.641-.076a5.61 5.61 0 0 0 4.971 3.016 5.612 5.612 0 0 0 2.753-10.5Z",
        ],
    },
    PEN_RATIO: {
        paths: [
            "M12.207.13a1.305 1.305 0 0 0-1.304 1.304 1.305 1.305 0 0 0 1.304 1.304 1.305 1.305 0 0 0 1.305-1.304A1.305 1.305 0 0 0 12.207.129M9.331.412 6.814 3.039.628.857l2.324 6.051L.36 9.463l9.413.269Zm1.52 3.21.13 2.764a3.46 3.46 0 0 1 .645 2.006 3.46 3.46 0 0 1-3.462 3.463A3.46 3.46 0 0 1 5.891 11l-2.578-.073a5.48 5.48 0 0 0 4.851 2.943 5.477 5.477 0 0 0 5.477-5.477 5.48 5.48 0 0 0-2.79-4.77Z",
        ],
    },
    SP_RECOVER: {
        paths: [
            "m6.997-.003-2 3.972A2.33 2.33 0 0 1 3.965 5L-.007 7l3.972 2c.446.224.807.585 1.032 1.03l2 3.973 2-3.972A2.33 2.33 0 0 1 10.026 9L14 7l-3.973-2a2.33 2.33 0 0 1-1.03-1.031Zm5.126.53-1.884 2.49h1.224v1.179h1.32v-1.18h1.224zM6.997 4.865q.032.001.06.071c.117.324.392 1.02.688 1.315.296.297.992.572 1.316.69.094.033.094.085 0 .119-.324.118-1.02.393-1.316.69s-.571.991-.689 1.315c-.034.094-.085.094-.12 0-.117-.325-.392-1.02-.688-1.316s-.992-.572-1.316-.689c-.094-.034-.094-.085 0-.12.324-.117 1.02-.393 1.316-.689s.572-.992.689-1.315q.026-.072.06-.07",
        ],
    },
    ANOMALY: {
        paths: [
            "M7 .287a6.69 6.69 0 0 0-6.69 6.69A6.69 6.69 0 0 0 7 13.667a6.69 6.69 0 0 0 6.69-6.69A6.69 6.69 0 0 0 7 .287m0 1.739a4.95 4.95 0 0 1 4.952 4.951A4.95 4.95 0 0 1 7 11.93a4.95 4.95 0 0 1-4.952-4.952A4.95 4.95 0 0 1 7 2.026m-2.175.98a.2.2 0 0 0-.204.199v1.733a.3.3 0 0 0 .145.26l2.089 1.296a.27.27 0 0 0 .29 0l2.09-1.296a.3.3 0 0 0 .144-.26V3.205a.2.2 0 0 0-.304-.17L7 4.323 4.925 3.035a.2.2 0 0 0-.1-.029m-.632 2.888a.3.3 0 0 0-.148.04L2.544 6.8a.2.2 0 0 0 .005.348l2.153 1.154-.078 2.44a.2.2 0 0 0 .299.179l1.5-.867a.3.3 0 0 0 .153-.254l.078-2.46a.27.27 0 0 0-.144-.25L4.342 5.93a.3.3 0 0 0-.15-.035Zm5.614 0a.3.3 0 0 0-.149.034L7.49 7.09a.27.27 0 0 0-.144.25l.077 2.46a.3.3 0 0 0 .153.254l1.5.867a.2.2 0 0 0 .3-.18l-.078-2.44 2.153-1.153a.2.2 0 0 0 .005-.349l-1.5-.866a.3.3 0 0 0-.149-.04Z",
        ],
    },

    // Element icons (14×14)
    PYRO: {
        paths: [
            "M7 0c-.5 1.5-2 3-3 4.5C3 6 2.5 7.5 3 9c.5 2 2.5 4.5 4 5 1.5-.5 3.5-3 4-5 .5-1.5 0-3-1-4.5C9 3.5 7.5 1.5 7 0Z",
            "M7 4c.7 1 1.5 1.8 1.7 2.5.3 1 .2 2-.4 2.7-.3.4-.8.6-1.3.6s-1-.2-1.3-.6c-.6-.7-.7-1.7-.4-2.7C5.5 5.8 6.3 5 7 4Z",
        ],
    },
    HYDRO: {
        paths: [
            "M7 0C5.5 2 3.5 4.5 2.5 7 1.5 9.5 2.5 12 4.5 13.2 5.3 13.7 6.1 14 7 14s1.7-.3 2.5-.8C11.5 12 12.5 9.5 11.5 7 10.5 4.5 8.5 2 7 0Zm0 3c1 1.4 2.2 3 2.8 4.5.7 1.7-.1 3.4-1.5 4.2-.4.2-.8.3-1.3.3s-.9-.1-1.3-.3C4.3 10.9 3.5 9.2 4.2 7.5 4.8 6 6 4.4 7 3Z",
        ],
    },
    CRYO: {
        paths: [
            "M6.4 0h1.2v14H6.4z",
            "M0 6.4h14v1.2H0z",
            "M1.55 1.55l.85-.85 11.05 11.05-.85.85z",
            "M.7 12.55l11.05-11.05.85.85L1.55 13.4z",
        ],
    },
    ELECTRO: {
        paths: ["M8.5 0H4L2 7.5h3L3.5 14 11 5.5H7.5z"],
    },
    ANEMO: {
        paths: [
            "M.2 4.905c.764 1.2 1.813 2.475 3.362 2.434 1.025-.067 2.374.224 2.679 1.36.313.864-.825 1.981-1.513 1.123-.108-.186-.04-.3.173-.325 1 .02 1.348-1.12.4-1.514-.813-.1-1.548.527-2.33.707C.792 9.32-.523 6.729.2 4.907zm9.912 2.43c-1.056-.074-2.45.563-2.375 1.785a.973.973 0 0 0 1.1.985c.316.012.724-.547.294-.613-1.621 0-1.022-2.1.346-1.4a5.2 5.2 0 0 0 2.343.687c1.8-.177 2.572-2.3 1.989-3.859-.871 1.303-1.957 2.597-3.697 2.414zm-2.42-.772a7.5 7.5 0 0 0 2.226-.861A3.067 3.067 0 0 0 9.286.09a5.14 5.14 0 0 1-1.594 6.473m-1.343-.014A5.07 5.07 0 0 1 4.734.07a3.075 3.075 0 0 0-1.122 5.287 8 8 0 0 0 2.7 1.235zm5.342-.09c-1.143.656-2.594.363-3.651 1.217a1.557 1.557 0 0 0 .07 2.768c.234.1.462.206.689.014.223-.167.4-.162.72-.012a9.1 9.1 0 0 0-2.512 3.482 9.2 9.2 0 0 0-2.523-3.478.605.605 0 0 1 .726 0c.6.347 1.443-.4 1.555-1 .247-1.179-.936-2.106-1.982-2.33-.512-.12-1.038-.182-1.55-.3C.866 6.337.51 3.94 1.669 2.105c.668 4.9 4 3.555 5.332 6.26 1.32-2.67 4.678-1.382 5.345-6.26.81 1.415 1.054 3.522-.655 4.354M7.57 11.65 7 11.271l-.572.385.58.972zM7 10.137a1.6 1.6 0 0 1-1 .911.925.925 0 0 0 .99-.272c.427.327.795.417 1.047.255A1.56 1.56 0 0 1 7 10.137",
        ],
    },
    GEO: {
        paths: [
            "M7 .5L11.5 4 12.5 9 9.5 13.5h-5L1.5 9 2.5 4z",
            "M7 3L9.5 5 10 8.5 8 11.5h-2L4 8.5 4.5 5z",
        ],
    },
    DENDRO: {
        paths: [
            "M12.5 1.5C5 2.5 1.5 6.5 1.5 12.5c6 0 10-3.5 11-11Z",
            "M3 11L11 3 11.5 3.5 3.5 11.5z",
        ],
    },
    PHYSICAL: {
        paths: [
            "M1.5 1.5L2.9 0.1 13.9 11.1 12.5 12.5z",
            "M11.1 0.1L12.5 1.5 1.5 12.5 0.1 11.1z",
        ],
    },
    QUANTUM: {
        paths: [
            "M6.301 11.017v-.958c0-.104.037-.3-.01-.392-.063-.117-.333-.147-.448-.2-.299-.137-.622-.294-.87-.518-.592-.534-.915-1.208-.915-2.004 0-.256.022-.52.116-.762a3.1 3.1 0 0 1 .602-.958c.223-.246.551-.465.85-.606.141-.067.3-.107.435-.185.245-.14.422-.355.61-.559.018.07 0 .125 0 .196-.003.184-.022.361-.022.545 0 .08.016.194-.047.257s-.16.037-.236.055c-.184.043-.37.101-.544.174-.645.268-1.258.88-1.329 1.604-.08.828.381 1.57 1.11 1.956.217.114.456.207.698.257.092.02.236.02.283.117.052.107.021.275.021.392 0 .3-.029.616 0 .914.05 1.251.08 2.512.11 3.658.298-.173.365-.587.442-.893.14-.563.29-1.21.69-1.655a3.6 3.6 0 0 1 .98-.758c.3-.159.62-.293.914-.468a4.3 4.3 0 0 0 1.473-1.43c.87-1.421.43-3.309-.777-4.398a4.6 4.6 0 0 0-1.088-.737c-.226-.106-.464-.181-.697-.272-.205-.08-.413-.16-.61-.257-.11-.055-.224-.158-.348-.171v1.023c0 .09-.038.295.03.363.041.043.133.053.188.073.116.042.235.087.348.138.35.155.724.387.98.675.31.346.533.738.646 1.19.308 1.234-.465 2.494-1.604 2.968-.228.095-.445.194-.632.363-.104.095-.215.288-.348.327.051-.279.004-.573.058-.85.013-.067-.014-.16.033-.217.048-.06.145-.058.214-.073.154-.032.31-.071.457-.13a2.66 2.66 0 0 0 1.002-.69 2 2 0 0 0 .286-.457c.106-.212.15-.438.15-.675 0-.231-.008-.457-.095-.675-.315-.783-1.16-1.35-1.996-1.415l-.022-.283-.022-1.263v-.697l-.043-1.045L7.302.544 7.28 0c-.269.078-.349.509-.41.74-.16.608-.286 1.302-.722 1.786a3.6 3.6 0 0 1-.936.736c-.3.163-.619.296-.915.468-.61.356-1.15.84-1.516 1.452-.874 1.463-.412 3.33.82 4.441.512.463 1.11.72 1.742.966.205.08.413.16.61.257.11.055.224.158.348.17m.304-5.747c0 .6-.065 1.187-.065 1.785-.019.207.05 1.51.018 1.535-.032.023-.072.004-.105-.004a2 2 0 0 1-.305-.09c-.375-.152-.692-.35-.94-.679-.447-.596-.353-1.398.135-1.938.186-.206.45-.347.696-.46a1.5 1.5 0 0 1 .566-.15M7.39 8.6c.06-.872.06-1.688.044-2.504-.003-.197.011-.394-.018-.588-.008-.05-.025-.174.021-.207.086-.061.282.026.367.055.36.12.727.342.95.653.204.28.37.642.335 1.001-.069.701-.558 1.218-1.198 1.466-.16.062-.328.124-.5.124z",
        ],
    },
    IMAGINARY: {
        paths: [
            "M7 0a7 7 0 1 0 0 14A7 7 0 0 0 7 0Zm0 1.4a5.6 5.6 0 0 1 0 11.2A2.8 2.8 0 0 1 7 7a2.8 2.8 0 0 0 0-5.6Z",
            "M7 4.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z",
            "M7 9.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
        ],
    },
    ZZZ_ICE: {
        paths: [
            "M7 0 5.166 3.824.938 3.5 3.332 7 .938 10.5l4.228-.323L7 14l1.834-3.823 4.228.323L10.668 7l2.394-3.5-4.228.324ZM5.18 5.06a.1.1 0 0 1 .06.015L7 5.99l1.76-.914a.123.123 0 0 1 .166.167l-.914 1.76.914 1.759a.123.123 0 0 1-.166.166L7 8.013l-1.76.914a.123.123 0 0 1-.166-.166L5.988 7l-.914-1.76a.123.123 0 0 1 .106-.18",
        ],
    },
    ZZZ_FIRE_FROST: {
        paths: [
            "M7.021 0c-.111 0-.5 1.435-1.35 2.226-.034.032-.003.122-.003.14.547.278 1.03.663 1.35 1.143.319-.575.773-.936 1.31-1.174 0 0 .037-.114 0-.146C7.519 1.482 7.133 0 7.022 0M.134 2.047c.109.24.306.355.481.547.209.227.39.518.537.79.382.708.54 1.53 1.01 2.187.836 1.163 2.65 1.723 3.987 1.094l-.42-.492-.613-.845c.616.25 1.324.927 1.878.921.634-.006 1.227-.68 1.829-.921a2.13 2.13 0 0 1-.608.898c-.105.09-.477.395-.477.395s.12.202.963.224c.779.045 1.805-.01 2.43-.55.87-.75 1.08-1.707 1.596-2.669.177-.33.365-.675.614-.958.172-.196.384-.342.525-.56-.302-.11-.722-.008-1.033.069-.777.192-1.392.431-2.066.876-.186.122-.687.46-.763.027-.052-.302.423-.585.52-.851-1.685.168-3.087.431-3.528 2.286-.218-1.452-2.124-2.354-3.58-2.286.155.245.858.66.516 1.013-.24.247-.735-.235-.942-.355-.881-.508-1.826-.836-2.856-.84m4.614 5.052c-.642.01-1.289.143-1.758.447-.338.218-.686.612-.912.941-.425.622-.57 1.405-.926 2.066a4 4 0 0 1-.598.85c-.163.17-.336.261-.42.487a5.53 5.53 0 0 0 2.917-.87c.183-.118.684-.53.872-.278.233.314-.31.67-.386.966 1.381-.07 3.041-.512 3.341-2.066.368.25.434.765.735 1.094.551.601 1.362.749 2.121.874.267.044.598.163.85.098-.136-.212-.74-.551-.618-.846.159-.386.594-.057.801.068a7.1 7.1 0 0 0 3.038 1.02c-.175-.478-.7-.874-.957-1.336-.426-.763-.596-1.67-1.134-2.37-.942-1.226-2.606-1.136-3.99-.99l.6.57.499.846-1.276-.743-.593-.223-.622.282-1.276.684.5-.728.593-.67a5 5 0 0 0-1.4-.173m2.204 3.392c-.319.575-.773.936-1.31 1.174 0 0-.038.114-.001.146C6.453 12.518 6.837 14 6.949 14c.11 0 .499-1.435 1.35-2.226.034-.032.003-.122.003-.14-.548-.278-1.03-.663-1.35-1.143",
        ],
    },
    ETHER: {
        paths: [
            "M7 0a7 7 0 1 0 0 14A7 7 0 0 0 7 0Zm0 1.6a5.4 5.4 0 1 1 0 10.8A5.4 5.4 0 0 1 7 1.6Z",
            "M7 3.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8zm0 1.6a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z",
        ],
    },
};

// Render an SVG icon at (x, y) sized `size` × `size`. Honours per-icon viewBox.
function drawSvgIcon(
    ctx: SKRSContext2D,
    icon: SvgIcon | null | undefined,
    x: number,
    y: number,
    size: number,
    color: string,
    opacity = 1
) {
    if (!icon || !icon.paths || !icon.paths.length) return;
    const vb = icon.viewBox ?? 14;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    const scale = size / vb;
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    for (const d of icon.paths) {
        try {
            const p = new Path2D(d);
            ctx.fill(p);
        } catch {
            /* ignore malformed path */
        }
    }
    ctx.restore();
}

// Resolve a stat-name (across GI / HSR / ZZZ) to an SVG icon.
function getStatIcon(name: string): SvgIcon | null {
    if (!name) return null;
    const n = name.toLowerCase();

    // Element-specific DMG bonuses (check element keyword first)
    if (/pyro/.test(n)) return SVG_ICONS.PYRO;
    if (/hydro/.test(n)) return SVG_ICONS.HYDRO;
    if (/cryo/.test(n)) return SVG_ICONS.CRYO;
    if (/electro/.test(n)) return SVG_ICONS.ELECTRO;
    if (/anemo/.test(n)) return SVG_ICONS.ANEMO;
    if (/geo/.test(n)) return SVG_ICONS.GEO;
    if (/dendro/.test(n)) return SVG_ICONS.DENDRO;
    if (/quantum/.test(n)) return SVG_ICONS.QUANTUM;
    if (/imaginary/.test(n)) return SVG_ICONS.IMAGINARY;
    if (/ether/.test(n)) return SVG_ICONS.ETHER;
    if (/(?:fire[\s-]*frost|frost[\s-]*fire)/.test(n)) return SVG_ICONS.ZZZ_FIRE_FROST;
    if (/\bice\b|frost/.test(n)) return SVG_ICONS.ZZZ_ICE;
    if (/\bfire\b/.test(n)) return SVG_ICONS.PYRO;
    if (/lightning|electric/.test(n)) return SVG_ICONS.ELECTRO;
    if (/\bwind\b/.test(n)) return SVG_ICONS.ANEMO;
    if (/physical/.test(n)) return SVG_ICONS.PHYSICAL;

    // Generic stat names
    if (/crit\s*(dmg|damage|hurt)/.test(n)) return SVG_ICONS.CRIT_DMG;
    if (/crit/.test(n)) return SVG_ICONS.CRIT;
    if (/energy\s*recharge|recharge/.test(n)) return SVG_ICONS.ER;
    if (/energy\s*(regen|recover)|sp\s*(ratio|recover)/.test(n)) return SVG_ICONS.SP_RATIO;
    if (/element(al)?\s*mastery/.test(n)) return SVG_ICONS.EM;
    if (/anomaly\s*(mastery|proficiency)/.test(n)) return SVG_ICONS.ANOMALY;
    if (/break\s*effect/.test(n)) return SVG_ICONS.BREAK_EFFECT;
    if (/impact|stun/.test(n)) return SVG_ICONS.IMPACT;
    if (/effect\s*hit\s*rate|status\s*probability/.test(n)) return SVG_ICONS.EHR;
    if (/effect\s*res|status\s*resist/.test(n)) return SVG_ICONS.ERES;
    if (/speed/.test(n)) return SVG_ICONS.SPEED;
    if (/pen\s*ratio|penetration\s*ratio/.test(n)) return SVG_ICONS.PEN_RATIO;
    if (/pen(etration)?/.test(n)) return SVG_ICONS.PEN_DELTA;
    if (/heal|outgoing\s*healing/.test(n)) return SVG_ICONS.SP_RECOVER;
    if (/shield/.test(n)) return SVG_ICONS.SHIELD;

    // Generic DMG bonus fallback
    if (/dmg\s*bonus|damage\s*bonus|dmg\s*boost|elem\s*bonus/.test(n)) return SVG_ICONS.PYRO;

    if (/^def|defense|defence/.test(n)) return SVG_ICONS.DEF;
    if (/^atk|attack/.test(n)) return SVG_ICONS.ATK;
    if (/^hp|max\s*hp|health/.test(n)) return SVG_ICONS.HP;

    return null;
}

function drawBackground(ctx: SKRSContext2D, bg: any, fallback: string) {
    if (bg) {
        ctx.drawImage(bg, 0, 0, W, H);
    } else {
        ctx.fillStyle = fallback;
        ctx.fillRect(0, 0, W, H);
    }
    // Dark overlay for readability
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
}

function drawColumnSeparators(ctx: SKRSContext2D) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(COL2_X - 1, 16, 2, CARD_H - 32);
    ctx.fillRect(COL3_X - 1, 16, 2, CARD_H - 32);
}

function drawPortraitColumn(
    ctx: SKRSContext2D,
    portImg: any,
    accent: string,
    name: string,
    level: number,
    maxLevel: number,
    subtitle: string
) {
    // Portrait fills col1 background
    if (portImg) {
        const offC = createCanvas(COL1_W, CARD_H);
        const offCtx = offC.getContext("2d");
        const s = Math.max(COL1_W / portImg.width, CARD_H / portImg.height);
        const dw = portImg.width * s;
        const dh = portImg.height * s;
        offCtx.drawImage(portImg, (COL1_W - dw) / 2, (CARD_H - dh) / 2, dw, dh);

        offCtx.globalCompositeOperation = "destination-out";
        const fade = offCtx.createLinearGradient(COL1_W - 140, 0, COL1_W, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)");
        fade.addColorStop(1, "rgba(0,0,0,1)");
        offCtx.fillStyle = fade;
        offCtx.fillRect(COL1_W - 140, 0, 140, CARD_H);

        ctx.save();
        ctx.beginPath();
        ctx.rect(COL1_X, 0, COL1_W, CARD_H);
        ctx.clip();
        ctx.drawImage(offC, COL1_X, 0);
        ctx.restore();
    }

    // Top header bar (name + level area)
    box(ctx, 0, 0, COL1_W, 96, 0, "rgba(0,0,0,0.60)");
    // Accent left border
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 4, 96);
    // Accent top gradient strip
    const topStrip = ctx.createLinearGradient(4, 0, COL1_W, 0);
    topStrip.addColorStop(0, accent + "33");
    topStrip.addColorStop(1, "transparent");
    ctx.fillStyle = topStrip;
    ctx.fillRect(4, 0, COL1_W - 4, 3);

    // Character name (Enka-style: large bold)
    ctx.fillStyle = "#fff";
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(fitText(ctx, name || "Unknown", COL1_W - 28), 18, 38);

    // Level row: "Lv. 90" (bright) + "/90" (dim) — Enka style
    ctx.font = `bold 15px ${FONT}`;
    const lvText = `Lv. ${level}`;
    ctx.fillStyle = "#dbe3ec";
    ctx.fillText(lvText, 18, 62);
    if (maxLevel) {
        const lvW = ctx.measureText(lvText).width;
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(` / ${maxLevel}`, 18 + lvW, 62);
    }

    // Element icon + subtitle row (Enka "fren" area)
    if (subtitle) {
        // Try to match element name to an icon
        const elemIconKey = (() => {
            const s = subtitle.toLowerCase();
            if (s.includes("pyro") || s.includes("fire")) return "PYRO";
            if (s.includes("hydro") || s.includes("water")) return "HYDRO";
            if (s.includes("cryo") || s.includes("ice")) return "CRYO";
            if (s.includes("electro") || s.includes("lightning")) return "ELECTRO";
            if (s.includes("anemo") || s.includes("wind")) return "ANEMO";
            if (s.includes("geo") || s.includes("rock")) return "GEO";
            if (s.includes("dendro") || s.includes("grass")) return "DENDRO";
            if (s.includes("quantum")) return "QUANTUM";
            if (s.includes("imaginary")) return "IMAGINARY";
            if (s.includes("ether")) return "ETHER";
            if (s.includes("firefrost") || s.includes("fire frost")) return "ZZZ_FIRE_FROST";
            if (s.includes("physical")) return "PHYSICAL";
            return null;
        })();

        let subtitleX = 18;
        if (elemIconKey && SVG_ICONS[elemIconKey]) {
            // Small element icon circle (Enka "fren" style)
            ctx.beginPath();
            ctx.arc(subtitleX + 8, 78, 9, 0, Math.PI * 2);
            ctx.fillStyle = accent + "44";
            ctx.fill();
            ctx.strokeStyle = accent + "88";
            ctx.lineWidth = 1;
            ctx.stroke();
            drawSvgIcon(ctx, SVG_ICONS[elemIconKey], subtitleX + 1, 69, 14, accent);
            subtitleX = 36;
        }
        ctx.fillStyle = "#9fb4c8";
        ctx.font = `12px ${FONT}`;
        ctx.fillText(clip(subtitle, 40), subtitleX, 82);
    }

    // Thin accent separator below header
    ctx.fillStyle = accent + "55";
    ctx.fillRect(18, 96, COL1_W - 36, 1);
}

function drawConstellationColumn(
    ctx: SKRSContext2D,
    icons: Map<string, any>,
    keyPrefix: string,
    unlocked: number,
    accent: string,
    total = 6
) {
    // Vertical stack on left edge of col1 (Enka style)
    const startY = 108;
    const x = 10;
    const r = 22;
    const gap = 7;
    for (let i = 0; i < total; i++) {
        const cy = startY + i * (r * 2 + gap) + r;
        const active = i < unlocked;

        // Outer glow ring (accent for active, subtle for locked)
        ctx.beginPath();
        ctx.arc(x + r, cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = active ? accent + "44" : "rgba(0,0,0,0.35)";
        ctx.fill();

        // Inner background
        ctx.beginPath();
        ctx.arc(x + r, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = active ? accent + "cc" : "rgba(10,18,30,0.80)";
        ctx.fill();
        ctx.strokeStyle = active ? accent : "rgba(255,255,255,0.18)";
        ctx.lineWidth = active ? 1.5 : 1;
        ctx.stroke();

        const ic = icons.get(`${keyPrefix}${i}`);
        if (ic) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + r, cy, r - 4, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = active ? 1 : 0.25;
            const sc = ((r - 4) * 2) / Math.max(ic.width, ic.height);
            ctx.drawImage(
                ic,
                x + r - (ic.width * sc) / 2,
                cy - (ic.height * sc) / 2,
                ic.width * sc,
                ic.height * sc
            );
            ctx.restore();
            ctx.globalAlpha = 1;

            // Lock icon for inactive slots (Enka style)
            if (!active) {
                const lockSize = 10;
                const lx = x + r * 2 - lockSize - 1;
                const ly = cy + r - lockSize - 1;
                box(ctx, lx, ly, lockSize, lockSize, 3, "rgba(0,0,0,0.88)");
                // Simple lock shape: arc (shackle) + rect (body)
                ctx.fillStyle = "rgba(255,255,255,0.50)";
                ctx.fillRect(lx + 2.5, ly + 5, 5, 4);
                ctx.strokeStyle = "rgba(255,255,255,0.50)";
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(lx + 5, ly + 4.5, 2.5, Math.PI, 0);
                ctx.stroke();
            }
        } else {
            ctx.fillStyle = active ? "#0d1620" : "rgba(255,255,255,0.30)";
            ctx.font = `bold 13px ${FONT}`;
            const lbl = String(i + 1);
            ctx.fillText(lbl, x + r - ctx.measureText(lbl).width / 2, cy + 5);
            if (!active) {
                // Lock indicator
                ctx.fillStyle = "rgba(255,255,255,0.35)";
                ctx.font = `10px ${FONT}`;
                ctx.fillText("🔒", x + r + 8, cy + r - 4);
            }
        }
    }
}

function drawTalentsRow(
    ctx: SKRSContext2D,
    icons: Map<string, any>,
    keyPrefix: string,
    skills: { level: number; name?: string }[],
    label: string,
    accent: string,
    count: number
) {
    const yTop = CARD_H - 90;
    box(ctx, 80, yTop, COL1_W - 90, 70, 12, "rgba(0,0,0,0.6)", accent + "55", 1);

    ctx.fillStyle = "#9fb4c8";
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(label.toUpperCase(), 92, yTop + 16);

    const usable = Math.min(skills.length, count);
    if (usable === 0) return;

    const slotW = (COL1_W - 110) / count;
    for (let i = 0; i < usable; i++) {
        const cx = 92 + slotW * i + slotW / 2;
        const cy = yTop + 44;
        const r = 18;

        // BG circle
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fill();

        const ic = icons.get(`${keyPrefix}${i}`);
        if (ic) drawCircleIcon(ctx, ic, cx, cy, r - 2);

        // Stroke
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Level pill
        const lvl = String(skills[i].level);
        const pillW = ctx.measureText(lvl).width + 12;
        const px = cx - pillW / 2;
        const py = cy + r - 4;
        box(ctx, px, py, pillW, 16, 8, accent, "rgba(255,255,255,0.3)", 1);
        ctx.fillStyle = "#0d1620";
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText(lvl, cx - ctx.measureText(lvl).width / 2, py + 12);
    }
}

// Weapon / Light Cone / W-Engine card (top of col2) — Enka style
function drawWeaponCard(
    ctx: SKRSContext2D,
    icon: any,
    title: string,
    accent: string,
    primary: { name: string; value: string } | null,
    secondary: { name: string; value: string } | null,
    refineLabel: string,
    levelLabel: string,
    starsCount: number
) {
    const x = COL2_X + 10;
    const y = 16;
    const w = COL2_W - 20;
    const h = 130;

    // Background with accent sheen on left (Enka style)
    box(ctx, x, y, w, h, 14, "rgba(8,15,24,0.80)", accent + "55", 1);
    const sheen = ctx.createLinearGradient(x, y, x + 80, y);
    sheen.addColorStop(0, accent + "22");
    sheen.addColorStop(1, "transparent");
    rr(ctx, x, y, w, h, 14);
    ctx.fillStyle = sheen;
    ctx.fill();

    // Weapon Icon with accent glow border
    const iconSize = 72;
    const ix = x + 12;
    const iy = y + 12;
    if (icon) {
        box(ctx, ix - 2, iy - 2, iconSize + 4, iconSize + 4, 10, accent + "33");
        drawIcon(ctx, icon, ix, iy, iconSize, 8);
    } else {
        box(ctx, ix, iy, iconSize, iconSize, 8, "rgba(255,255,255,0.05)", accent + "44", 1);
    }

    // Stars (below icon)
    ctx.fillStyle = "#ffd566";
    ctx.font = `11px ${FONT}`;
    ctx.fillText(stars(starsCount), ix, iy + iconSize + 16);

    // Name (bold, right of icon)
    const capX = ix + iconSize + 14;
    const capW = x + w - capX - 10;
    ctx.fillStyle = "#fff";
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(fitText(ctx, title || "Unknown", capW), capX, y + 28);

    // Refinement + Level pills (Enka style: colored pill)
    let pillX = capX;
    const pillY = y + 36;
    if (refineLabel) {
        const tw = ctx.measureText(refineLabel).width + 10;
        box(ctx, pillX, pillY, tw, 18, 4, accent + "dd");
        ctx.fillStyle = "#0d1620";
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText(refineLabel, pillX + 5, pillY + 13);
        pillX += tw + 6;
    }
    if (levelLabel) {
        const tw = ctx.measureText(levelLabel).width + 10;
        box(ctx, pillX, pillY, tw, 18, 4, "rgba(255,255,255,0.15)");
        ctx.fillStyle = "#fff";
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText(levelLabel, pillX + 5, pillY + 13);
    }

    // Primary stat (e.g. Base ATK) — icon + name + large value
    if (primary) {
        const ic = getStatIcon(primary.name);
        let nx = capX;
        if (ic) {
            drawSvgIcon(ctx, ic, nx, y + 64, 14, "#9fb4c8");
            nx += 18;
        }
        ctx.fillStyle = "#9fb4c8";
        ctx.font = `11px ${FONT}`;
        ctx.fillText(primary.name, nx, y + 75);
        ctx.fillStyle = "#fff";
        ctx.font = `bold 22px ${FONT}`;
        ctx.fillText(primary.value, capX, y + 103);
    }

    // Secondary stat — smaller, with icon + accent color
    if (secondary) {
        const ic = getStatIcon(secondary.name);
        const sec2X = capX + (capW / 2);
        let nx = sec2X;
        if (ic) {
            drawSvgIcon(ctx, ic, nx, y + 64, 13, accent);
            nx += 17;
        }
        ctx.fillStyle = accent;
        ctx.font = `11px ${FONT}`;
        ctx.fillText(secondary.name, nx, y + 75);
        const valW = ctx.measureText(secondary.value).width;
        ctx.fillStyle = "#fff";
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillText(secondary.value, sec2X + capW / 2 - valW - 4, y + 103);
    }
}

// Stats table (middle column) — Enka style: dots separator + base/bonus sub-row
function drawStatsTable(
    ctx: SKRSContext2D,
    rows: { name: string; value: string; extra?: string; highlight?: boolean }[],
    yTop: number,
    accent: string,
    label = "STATS"
) {
    const x = COL2_X + 10;
    const w = COL2_W - 20;
    const BASE_ROW_H = 30;
    const EXTRA_ROW_H = 44; // taller when base+bonus sub-row is shown

    // Section label (Enka style: small uppercase with accent underline)
    if (label) {
        ctx.fillStyle = accent;
        ctx.font = `bold 10px ${FONT}`;
        ctx.fillText(label, x, yTop - 4);
        ctx.fillStyle = accent;
        ctx.fillRect(x, yTop, ctx.measureText(label).width, 1.5);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x + ctx.measureText(label).width + 4, yTop, w - ctx.measureText(label).width - 4, 1);
    }

    // Total height based on per-row needs
    const rowHeights = rows.map((r) => (r.extra ? EXTRA_ROW_H : BASE_ROW_H));
    const totalH = rowHeights.reduce((a, b) => a + b, 0) + 16;

    box(ctx, x, yTop, w, totalH, 12, "rgba(8,15,24,0.65)", "rgba(255,255,255,0.05)", 1);

    let ry = yTop + 12;
    rows.forEach((row, i) => {
        const rh = rowHeights[i];

        // Subtle row stripe
        if (i % 2 === 0) {
            box(ctx, x + 4, ry - 2, w - 8, rh - 2, 4, "rgba(255,255,255,0.025)");
        }

        // SVG stat icon (or fallback bullet)
        const icon = getStatIcon(row.name);
        const iconColor = row.highlight ? accent : "#c4d3e0";
        let nameX = x + 14;
        if (icon) {
            drawSvgIcon(ctx, icon, x + 10, ry + 2, 16, iconColor, row.highlight ? 1 : 0.85);
            nameX = x + 30;
        } else {
            ctx.fillStyle = row.highlight ? accent : "rgba(255,255,255,0.45)";
            ctx.beginPath();
            ctx.arc(x + 14, ry + 10, 3, 0, Math.PI * 2);
            ctx.fill();
            nameX = x + 24;
        }

        // Name
        ctx.fillStyle = row.highlight ? "#fff" : "#c4d3e0";
        ctx.font = `${row.highlight ? "bold " : ""}13px ${FONT}`;
        const nameText = clip(row.name, 22);
        ctx.fillText(nameText, nameX, ry + 14);
        const nw = ctx.measureText(nameText).width;

        // Value
        ctx.fillStyle = row.highlight ? accent : "#fff";
        ctx.font = `bold 14px ${FONT}`;
        const vw = ctx.measureText(row.value).width;
        ctx.fillText(row.value, x + w - 12 - vw, ry + 14);



        // Sub-row: base + bonus breakdown (Enka style)
        if (row.extra) {
            // Thin separator line
            ctx.strokeStyle = "rgba(255,255,255,0.07)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nameX, ry + 20);
            ctx.lineTo(x + w - 12, ry + 20);
            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255,0.38)";
            ctx.font = `10px ${FONT}`;
            ctx.fillText(row.extra, nameX + 18, ry + 32);

            // Small arrow/plus indicator
            ctx.fillStyle = accent + "99";
            ctx.font = `9px ${FONT}`;
            ctx.fillText("▸", nameX + 2, ry + 32);
        }

        ry += rh;
    });
}

// Right column: vertical stack of artifact cards
interface ArtifactDisplay {
    slotLabel: string;
    setLabel: string;
    level: number;
    rarity: number;
    icon: any | null;
    mainStat: { name: string; value: string };
    subStats: { name: string; value: string }[];
}

function drawArtifactsColumn(
    ctx: SKRSContext2D,
    items: (ArtifactDisplay | null)[],
    accent: string,
    title: string
) {
    const x = COL3_X + 10;
    const yTop = 16;
    const w = COL3_W - 20;
    const titleH = 24;
    const gap = 5;
    const total = items.length;
    const cardH = Math.floor((CARD_H - titleH - 30 - gap * (total - 1)) / total);

    // Title header (Enka style: text + accent underline)
    ctx.fillStyle = accent;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(title.toUpperCase(), x, yTop + 11);
    const titleW = ctx.measureText(title.toUpperCase()).width;
    // Accent underline
    ctx.fillStyle = accent;
    ctx.fillRect(x, yTop + 14, titleW, 2);
    // Dim underline to edge
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + titleW + 4, yTop + 14, w - titleW - 4, 1);

    items.forEach((it, i) => {
        const cy = yTop + titleH + 6 + i * (cardH + gap);
        drawArtifactCard(ctx, x, cy, w, cardH, it, accent);
    });
}

function drawArtifactCard(
    ctx: SKRSContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    a: ArtifactDisplay | null,
    accent: string
) {
    // Background with subtle gradient sheen on the left (Enka style)
    box(ctx, x, y, w, h, 10, "rgba(8,15,24,0.72)", "rgba(255,255,255,0.06)", 1);
    // Accent tint on left edge
    const edgeGrad = ctx.createLinearGradient(x, y, x + 60, y);
    edgeGrad.addColorStop(0, accent + "22");
    edgeGrad.addColorStop(1, "transparent");
    rr(ctx, x, y, w, h, 10);
    ctx.fillStyle = edgeGrad;
    ctx.fill();

    if (!a) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.font = `12px ${FONT}`;
        ctx.fillText("Empty Slot", x + 16, y + h / 2 + 4);
        return;
    }

    const pad = 9;

    // LEFT: Artifact image icon
    const iconS = Math.min(h - pad * 2, 76);
    const ix = x + pad;
    const iy = y + (h - iconS) / 2;

    if (a.icon) {
        // Slightly glowing border around icon (Enka style)
        box(ctx, ix - 2, iy - 2, iconS + 4, iconS + 4, 8, accent + "44");
        drawIcon(ctx, a.icon, ix, iy, iconS, 6);
    } else {
        box(ctx, ix, iy, iconS, iconS, 6, "rgba(255,255,255,0.04)", accent + "33", 1);
    }

    // Slot label at bottom of icon
    const slotLbl = a.slotLabel.toUpperCase();
    ctx.font = `bold 8px ${FONT}`;
    const slotW = ctx.measureText(slotLbl).width + 8;
    const slotPillX = ix + (iconS - slotW) / 2;
    const slotPillY = iy + iconS - 13;
    box(ctx, slotPillX, slotPillY, slotW, 11, 3, "rgba(0,0,0,0.88)", accent + "aa", 1);
    ctx.fillStyle = accent;
    ctx.fillText(slotLbl, slotPillX + 4, slotPillY + 8);

    // RIGHT AREA
    const mainX = ix + iconS + 10;

    // Level badge (top-right, gold) — Enka style
    const levelText = `+${a.level}`;
    ctx.font = `bold 11px ${FONT}`;
    const lvW = ctx.measureText(levelText).width + 10;
    const lvX = x + w - pad - lvW;
    box(ctx, lvX, y + pad, lvW, 17, 4, "#ffd566");
    ctx.fillStyle = "#0d1620";
    ctx.fillText(levelText, lvX + 5, y + pad + 12);

    // MAIN STAT
    // Layout:
    //   ROW 1 (top):  [icon] STAT_NAME                       [+lvl]
    //   ROW 1.5:                                             ★★★★★
    //   ROW 2:        BIG VALUE
    const mainIcon = getStatIcon(a.mainStat.name);
    const valFontPx = h <= 108 ? 18 : 20;

    // Row 1 — icon + stat name (left side); level badge already placed top-right
    const topY = y + pad + 4;
    const topIconSize = 16;
    let topX = mainX;
    if (mainIcon) {
        // Shaded glow + crisp icon (Enka ShadedSvgIcon style)
        ctx.save();
        ctx.globalAlpha = 0.30;
        drawSvgIcon(ctx, mainIcon, topX - 1, topY - 1, topIconSize + 2, "#ffffff");
        ctx.restore();
        drawSvgIcon(ctx, mainIcon, topX, topY, topIconSize, "#dbe3ec");
        topX += topIconSize + 6;
    }

    // Stat name beside the icon (HP%, CRIT Rate, …)
    const nameMaxW = Math.max(0, lvX - topX - 6);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(fitText(ctx, a.mainStat.name, nameMaxW), topX, topY + 12);

    // Stars: right-aligned, just below the [+lvl] badge
    const starsY = y + pad + 30;
    ctx.fillStyle = "#ffd566";
    ctx.font = `bold 11px ${FONT}`;
    const starsText = stars(a.rarity);
    const starsW = ctx.measureText(starsText).width;
    ctx.fillText(starsText, x + w - pad - starsW, starsY);

    // Big value — own line below the icon row (avoids overlap)
    const bigY = topY + topIconSize + 18;
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${valFontPx}px ${FONT}`;
    ctx.fillText(a.mainStat.value, mainX, bigY);

    // HR separator
    const hrY = bigY + 8;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mainX, hrY);
    ctx.lineTo(x + w - pad, hrY);
    ctx.stroke();

    const subs = a.subStats.slice(0, 4);
    const subStartY = hrY + 6;
    const subAreaH = y + h - subStartY - pad;
    const subRowH = Math.max(16, subAreaH / 2);
    const subColW = (x + w - pad - mainX) / 2;

    subs.forEach((s, idx) => {
        const col = idx % 2;
        const rowIdx = Math.floor(idx / 2);
        const sx = mainX + col * subColW;
        const sy = subStartY + rowIdx * subRowH;

        // Highlight valuable stats (CRIT, EM, DMG bonus, etc.) with full-white value
        const isHighlight = /CRIT|DMG Bonus|Elemental Mastery|Energy Recharge/i.test(s.name);

        // SVG icon at the row start (no preceding dots)
        let textX = sx;
        const subIc = getStatIcon(s.name);
        if (subIc) {
            drawSvgIcon(ctx, subIc, textX, sy - 1, 13, isHighlight ? "#fff" : "rgba(255,255,255,0.78)");
            textX += 16;
        }

        // Value (right-aligned, gold/white if highlight)
        ctx.font = `bold 12px ${FONT}`;
        const vw = ctx.measureText(s.value).width;
        const vx = sx + subColW - vw - 4;
        ctx.fillStyle = isHighlight ? "#fff" : "rgba(255,255,255,0.78)";
        ctx.fillText(s.value, vx, sy + 9);

        // Name (truncated to remaining space, dimmed)
        const subNameMaxW = Math.max(0, vx - textX - 4);
        ctx.fillStyle = "rgba(255,255,255,0.50)";
        ctx.font = `10px ${FONT}`;
        ctx.fillText(fitText(ctx, s.name, subNameMaxW), textX, sy + 9);
    });
}

// Footer
function drawFooter(
    ctx: SKRSContext2D,
    nickname: string,
    uid: number,
    credit: string,
    pfpImg?: any,
    accent = "#4fc3f7"
) {
    // Footer background
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
    // Top accent line
    ctx.fillStyle = accent + "66";
    ctx.fillRect(0, H - FOOTER_H, W, 2);

    let textX = 18;
    if (pfpImg) {
        const s = FOOTER_H - 16;
        const cy = H - FOOTER_H + 8;
        ctx.save();
        ctx.beginPath();
        ctx.arc(textX + s / 2, cy + s / 2, s / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(pfpImg, textX, cy, s, s);
        ctx.restore();
        // Ring
        ctx.beginPath();
        ctx.arc(textX + s / 2, cy + s / 2, s / 2 + 1, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        textX += s + 12;
    }

    ctx.fillStyle = "#7a8a9c";
    ctx.font = `10px ${FONT}`;
    ctx.fillText("OWNER", textX, H - FOOTER_H + 18);
    ctx.fillStyle = "#fff";
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(nickname || "Unknown", textX, H - FOOTER_H + 40);
    const nameW = ctx.measureText(nickname || "Unknown").width;

    ctx.fillStyle = "#7a8a9c";
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`UID ${uid}`, textX + nameW + 16, H - FOOTER_H + 40);

    ctx.fillStyle = accent;
    ctx.font = `bold 11px ${FONT}`;
    const cw = ctx.measureText(credit).width;
    ctx.fillText(credit, W - cw - 18, H - FOOTER_H + 40);
}

function emptyCard(nickname: string, uid: number, game: string): Buffer {
    const canvas = createCanvas(900, 200);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0c1a2a";
    ctx.fillRect(0, 0, 900, 200);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, 0, 6, 200);
    ctx.fillStyle = "#fff";
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillText(nickname, 28, 56);
    ctx.fillStyle = "#888";
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`UID ${uid}  ·  ${game}`, 28, 90);
    ctx.fillStyle = "#555";
    ctx.font = `13px ${FONT}`;
    ctx.fillText("Showcase is empty or set to private.", 28, 130);
    ctx.fillStyle = "#444";
    ctx.font = `11px ${FONT}`;
    ctx.fillText("ChisatoBOT · Enka.Network", 28, 160);
    return Buffer.from(canvas.toBuffer("image/png"));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GENSHIN IMPACT
// ═══════════════════════════════════════════════════════════════════════════════
const GI_SLOTS: Record<string, string> = {
    Flower: "Flower",
    Plume: "Plume",
    Sands: "Sands",
    Goblet: "Goblet",
    Circlet: "Circlet",
};
const GI_SLOT_ORDER = ["Flower", "Plume", "Sands", "Goblet", "Circlet"];
const GI_HIGHLIGHT_STATS = new Set(["CRIT Rate", "CRIT DMG", "Energy Recharge", "Elemental Mastery"]);

export async function generateGenshinImage(user: EnkaUserData): Promise<Buffer[]> {
    if (!user.characters.length) return [emptyCard(user.nickname, user.uid, "Genshin Impact")];
    // Run cards in parallel — each card is independent; bottleneck is network IO
    // for icon fetch, which the icon cache makes near-instant on warm runs.
    const settled = await Promise.all(
        user.characters.map((c) => giCard(user, c).catch(() => null))
    );
    const out = settled.filter((b): b is Buffer => b !== null);
    return out.length ? out : [emptyCard(user.nickname, user.uid, "Genshin Impact")];
}

async function giCard(user: EnkaUserData, char: EnkaCharacter): Promise<Buffer> {
    const accent = char.elementColor || "#4fc3f7";

    // Preload icons
    const jobs: [string, string][] = [];
    if (char.portrait) jobs.push(["port", `${ENKA}${char.portrait}.png`]);
    if (char.weapon?.icon) jobs.push(["wep", `${ENKA}${char.weapon.icon}.png`]);
    char.artifacts.forEach((a) => {
        if (a.icon) jobs.push([`a_${a.slot}`, `${ENKA}${a.icon}.png`]);
    });
    char.skills.slice(0, 3).forEach((s, i) => {
        if (s.icon) jobs.push([`sk${i}`, `${ENKA}${s.icon}.png`]);
    });
    char.constellationIcons.slice(0, 6).forEach((u, i) => {
        if (u) jobs.push([`con${i}`, u]);
    });
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, await loadBg("genshin"), "#0c1a2a");
    drawColumnSeparators(ctx);

    // ═══ COL 1: Portrait + Name + Constellations + Talents ═══
    drawPortraitColumn(
        ctx,
        icons.get("port"),
        accent,
        char.name ?? "Unknown",
        char.level,
        char.maxLevel || 90,
        char.element || ""
    );
    drawConstellationColumn(ctx, icons, "con", char.constellation, accent);
    drawTalentsRow(ctx, icons, "sk", char.skills.slice(0, 3), "Talents", accent, 3);

    // ═══ COL 2: Weapon + Stats + Set ═══
    if (char.weapon) {
        const wIcon = icons.get("wep");
        const wepStats = char.stats.find((s) => /Weapon/i.test(s.name));
        drawWeaponCard(
            ctx,
            wIcon,
            char.weapon.name ?? "Unknown",
            accent,
            wepStats ? { name: wepStats.name, value: wepStats.value } : null,
            null,
            `R${char.weapon.refinement}`,
            `Lv. ${char.weapon.level}`,
            char.weapon.stars
        );
    } else {
        drawWeaponCard(ctx, null, "No Weapon", accent, null, null, "", "", 0);
    }

    // Stats — pick the relevant ones
    const statNames = ["HP", "ATK", "DEF", "Elemental Mastery", "CRIT Rate", "CRIT DMG", "Energy Recharge"];
    const baseStats = statNames
        .map((n) => char.stats.find((s) => s.name === n))
        .filter(Boolean) as { name: string; value: string }[];
    // Element bonus (anything ending in DMG Bonus)
    const elemBonus = char.stats.find((s) => /DMG Bonus|Damage Bonus/i.test(s.name));
    if (elemBonus) baseStats.push(elemBonus);

    drawStatsTable(
        ctx,
        baseStats.map((s) => ({
            name: s.name,
            value: s.value,
            highlight: GI_HIGHLIGHT_STATS.has(s.name) || /DMG Bonus/i.test(s.name),
        })),
        160,
        accent
    );

    // Set bonus indicator
    const setCounts: Record<string, number> = {};
    char.artifacts.forEach((a) => {
        if (a.setName) setCounts[a.setName] = (setCounts[a.setName] || 0) + 1;
    });
    const setEntries = Object.entries(setCounts)
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1]);
    if (setEntries.length) {
        const [name, n] = setEntries[0];
        const sBoxY = CARD_H - 60;
        box(ctx, COL2_X + 10, sBoxY, COL2_W - 20, 44, 12, "rgba(8,15,24,0.72)", accent + "55", 1);
        ctx.fillStyle = "#9fb4c8";
        ctx.font = `bold 10px ${FONT}`;
        ctx.fillText("ARTIFACT SET", COL2_X + 22, sBoxY + 16);
        ctx.fillStyle = "#fff";
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillText(clip(name, 26), COL2_X + 22, sBoxY + 33);
        const pillX = COL2_X + COL2_W - 50;
        box(ctx, pillX, sBoxY + 12, 30, 22, 6, accent);
        ctx.fillStyle = "#0d1620";
        ctx.font = `bold 14px ${FONT}`;
        ctx.fillText(`${n}pc`, pillX + 3, sBoxY + 28);
    }

    // ═══ COL 3: 5 Artifacts (vertical) ═══
    const ordered: (ArtifactDisplay | null)[] = GI_SLOT_ORDER.map((slot) => {
        const a = char.artifacts.find((x) => x.slot === slot);
        if (!a) return null;
        return {
            slotLabel: GI_SLOTS[slot] || slot,
            setLabel: a.setName,
            level: a.level,
            rarity: a.rarity,
            icon: icons.get(`a_${slot}`) ?? null,
            mainStat: { name: a.mainStat.name, value: a.mainStat.value },
            subStats: a.subStats.slice(0, 4).map((s) => ({ name: s.name, value: s.value })),
        };
    });
    drawArtifactsColumn(ctx, ordered, accent, "Artifacts");

    // Footer
    let pfp: any = null;
    if (user.profileIcon) {
        const buf = await fetchBuf(user.profileIcon);
        if (buf)
            try {
                pfp = await loadImage(buf);
            } catch {
                /* ignore */
            }
    }
    drawFooter(ctx, user.nickname, user.uid, "Genshin Impact · ChisatoBOT", pfp, accent);
    return Buffer.from(canvas.toBuffer("image/png"));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HONKAI: STAR RAIL
// ═══════════════════════════════════════════════════════════════════════════════
const HSR_SLOTS = ["Head", "Hands", "Body", "Feet", "Sphere", "Rope"];

export async function generateHSRImage(user: HSRUserData): Promise<Buffer[]> {
    if (!user.characters.length) return [emptyCard(user.nickname, user.uid, "Honkai: Star Rail")];
    const settled = await Promise.all(
        user.characters.map((c) => hsrCard(user, c).catch(() => null))
    );
    const out = settled.filter((b): b is Buffer => b !== null);
    return out.length ? out : [emptyCard(user.nickname, user.uid, "Honkai: Star Rail")];
}

async function hsrCard(user: HSRUserData, char: HSRCharacter): Promise<Buffer> {
    const accent = char.elementColor || "#3fa6ff";

    const jobs: [string, string][] = [];
    if (char.portrait) jobs.push(["port", char.portrait]);
    if (char.lightCone?.icon) jobs.push(["lc", char.lightCone.icon]);
    char.skills.slice(0, 4).forEach((s, i) => {
        if (s.icon) jobs.push([`sk${i}`, s.icon]);
    });
    char.relics.forEach((r) => {
        if (r.icon) jobs.push([`r_${r.slotNum}`, r.icon]);
    });
    char.eidolonIcons.slice(0, 6).forEach((u, i) => {
        if (u) jobs.push([`con${i}`, u]);
    });
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, await loadBg("hsr"), "#0a1020");
    drawColumnSeparators(ctx);

    // ═══ COL 1 ═══
    drawPortraitColumn(
        ctx,
        icons.get("port"),
        accent,
        char.name,
        char.level,
        char.maxLevel || 80,
        `${char.element || ""}${char.path ? " · " + char.path : ""}`
    );
    drawConstellationColumn(ctx, icons, "con", char.eidolons, accent);
    drawTalentsRow(ctx, icons, "sk", char.skills.slice(0, 4), "Skill Tree", accent, 4);

    // ═══ COL 2 ═══
    if (char.lightCone) {
        const lc = char.lightCone;
        drawWeaponCard(
            ctx,
            icons.get("lc"),
            lc.name,
            accent,
            lc.atk ? { name: "ATK", value: lc.atk } : null,
            lc.bonus ? { name: "Bonus", value: lc.bonus } : null,
            `S${lc.superimposition}`,
            `Lv. ${lc.level}`,
            lc.rarity
        );
    } else {
        drawWeaponCard(ctx, null, "No Light Cone", accent, null, null, "", "", 0);
    }

    // Stats
    const allStats = char.attributes.map((a) => {
        const ex = char.additions?.find((x) => x.field === a.field);
        const extra = ex && ex.value > 0 ? `+${ex.display}` : undefined;
        return {
            name: a.name,
            value: a.display,
            extra,
            highlight: /CRIT|DMG Boost|Speed/i.test(a.name),
        };
    });
    drawStatsTable(ctx, allStats.slice(0, 9), 160, accent);

    // ═══ COL 3 ═══
    const orderedRel: (ArtifactDisplay | null)[] = Array.from({ length: 6 }, (_, i) => {
        const r: HSRRelic | undefined = char.relics.find((x) => x.slotNum === i + 1);
        if (!r) return null;
        return {
            slotLabel: HSR_SLOTS[r.slotNum - 1] || `Slot ${r.slotNum}`,
            setLabel: r.setName,
            level: r.level,
            rarity: r.rarity,
            icon: icons.get(`r_${r.slotNum}`) ?? null,
            mainStat: { name: r.mainStat.name, value: r.mainStat.display },
            subStats: r.subStats.slice(0, 4).map((s) => ({ name: s.name, value: s.display })),
        };
    });
    drawArtifactsColumn(ctx, orderedRel, accent, "Relics");

    let pfp: any = null;
    if (user.profileIcon) {
        const buf = await fetchBuf(user.profileIcon);
        if (buf)
            try {
                pfp = await loadImage(buf);
            } catch {
                /* ignore */
            }
    }
    drawFooter(ctx, user.nickname, user.uid, "Honkai: Star Rail · ChisatoBOT", pfp, accent);
    return Buffer.from(canvas.toBuffer("image/png"));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ZENLESS ZONE ZERO
// ═══════════════════════════════════════════════════════════════════════════════
const ZE: Record<string, string> = {
    Fire: "#ff6030",
    Ice: "#40d0ff",
    Electric: "#c080ff",
    Physical: "#c8c8c8",
    Ether: "#ff50c0",
    FireFrost: "#22bdcc",
};
const ZZZ_SKILL_LABELS = ["ATK", "Spec", "Dodge", "Asst", "Chain"];

export async function generateZZZImage(user: ZZZUserData): Promise<Buffer[]> {
    if (!user.agents.length) return [emptyCard(user.nickname, user.uid, "Zenless Zone Zero")];
    const settled = await Promise.all(
        user.agents.map((a) => zzzCard(user, a).catch(() => null))
    );
    const out = settled.filter((b): b is Buffer => b !== null);
    return out.length ? out : [emptyCard(user.nickname, user.uid, "Zenless Zone Zero")];
}

async function zzzCard(user: ZZZUserData, agent: ZZZAgent): Promise<Buffer> {
    const accent = (agent.element?.length ? ZE[agent.element[0]] : null) ?? "#ff6b35";

    const jobs: [string, string][] = [];
    if (agent.portrait) jobs.push(["port", agent.portrait]);
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    drawBackground(ctx, await loadBg("zzz"), "#0a0a0a");
    drawColumnSeparators(ctx);

    // ═══ COL 1 ═══
    drawPortraitColumn(
        ctx,
        icons.get("port"),
        accent,
        agent.name,
        agent.level,
        60,
        `${(agent.element || []).join("/") || ""}${agent.specialty ? " · " + agent.specialty : ""}`
    );

    // Mindscape (no icons available, just numbered circles)
    {
        const startY = 110;
        const x = 12;
        const r = 22;
        const gap = 8;
        for (let i = 0; i < 6; i++) {
            const cy = startY + i * (r * 2 + gap) + r;
            const active = i < agent.mindscape;
            ctx.beginPath();
            ctx.arc(x + r, cy, r + 2, 0, Math.PI * 2);
            ctx.fillStyle = active ? accent + "33" : "rgba(0,0,0,0.4)";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + r, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = active ? accent + "cc" : "rgba(0,0,0,0.65)";
            ctx.fill();
            ctx.strokeStyle = active ? accent : "rgba(255,255,255,0.25)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = active ? "#0d1620" : "rgba(255,255,255,0.55)";
            ctx.font = `bold 14px ${FONT}`;
            const lbl = `M${i + 1}`;
            ctx.fillText(lbl, x + r - ctx.measureText(lbl).width / 2, cy + 5);
        }
    }

    // Skills row at bottom (custom labels, no icons)
    {
        const yTop = CARD_H - 90;
        box(ctx, 80, yTop, COL1_W - 90, 70, 12, "rgba(0,0,0,0.6)", accent + "55", 1);
        ctx.fillStyle = "#9fb4c8";
        ctx.font = `bold 11px ${FONT}`;
        ctx.fillText("SKILLS", 92, yTop + 16);

        const slots = Math.min(agent.skillLevels?.length ?? 0, 5);
        const slotW = (COL1_W - 110) / 5;
        for (let i = 0; i < slots; i++) {
            const cx = 92 + slotW * i + slotW / 2;
            const cy = yTop + 44;
            const r = 16;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fill();
            ctx.strokeStyle = accent;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = `bold 13px ${FONT}`;
            const lv = String(agent.skillLevels[i]);
            ctx.fillText(lv, cx - ctx.measureText(lv).width / 2, cy + 5);
            ctx.fillStyle = "#9fb4c8";
            ctx.font = `8px ${FONT}`;
            const lab = ZZZ_SKILL_LABELS[i] || `S${i}`;
            ctx.fillText(lab, cx - ctx.measureText(lab).width / 2, cy + 22);
        }
    }

    // ═══ COL 2 ═══
    if (agent.weapon) {
        drawWeaponCard(
            ctx,
            null,
            agent.weapon.name ?? "W-Engine",
            accent,
            null,
            null,
            agent.weapon.refine ? `P${agent.weapon.refine}` : "",
            `Lv. ${agent.weapon.level}`,
            agent.weapon.stars
        );
    } else {
        drawWeaponCard(ctx, null, "No W-Engine", accent, null, null, "", "", 0);
    }

    const stats = (agent.stats ?? []).slice(0, 9).map((s) => ({
        name: s.name,
        value: s.value,
        highlight: /CRIT|Anomaly|Impact|Pen/i.test(s.name),
    }));
    drawStatsTable(ctx, stats, 160, accent);

    // ═══ COL 3 — 6 Drive Discs ═══
    const ordered: (ArtifactDisplay | null)[] = Array.from({ length: 6 }, (_, i) => {
        const d = agent.discs?.find((x) => x.slot === i + 1);
        if (!d) return null;
        return {
            slotLabel: `Drive ${i + 1}`,
            setLabel: d.setName ?? "",
            level: d.level,
            rarity: d.rarity,
            icon: null,
            mainStat: { name: d.mainStat.name, value: d.mainStat.value },
            subStats: d.subStats.slice(0, 4).map((s) => ({ name: s.name, value: s.value })),
        };
    });
    drawArtifactsColumn(ctx, ordered, accent, "Drive Discs");

    let pfp: any = null;
    if (user.profileIcon) {
        const buf = await fetchBuf(user.profileIcon);
        if (buf)
            try {
                pfp = await loadImage(buf);
            } catch {
                /* ignore */
            }
    }
    drawFooter(ctx, user.nickname, user.uid, "Zenless Zone Zero · ChisatoBOT", pfp, accent);
    return Buffer.from(canvas.toBuffer("image/png"));
}
