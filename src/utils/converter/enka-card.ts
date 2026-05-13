import { createCanvas, loadImage, SKRSContext2D } from "@napi-rs/canvas";
import axios from "axios";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import type { EnkaCharacter, EnkaUserData } from "../../types/lookup/enka";
import type { HSRCharacter, HSRRelic, HSRUserData } from "../../types/lookup/hsr";
import type { ZZZUserData, ZZZAgent } from "../../types/lookup/zzz";

// Config 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEDIA = path.resolve(__dirname, "../../../media");
const FONT = "'Segoe UI', 'Microsoft YaHei', sans-serif";
const FONT_B = `bold ${FONT}`;
const W = 1140, H = 640, FOOTER_H = 52;
const LEFT_W = 365, RX = LEFT_W, RW = W - LEFT_W;
const ENKA = "https://enka.network/ui/";
const CDN_HSR = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
const ENKA_ZZZ = "https://enka.network/ui/zzz/";

// Helpers
async function loadBg(game: string) {
    const p = path.join(MEDIA, `background_card_${game}.png`);
    if (fs.existsSync(p)) return loadImage(fs.readFileSync(p));
    return null;
}
async function fetchBuf(url: string): Promise<Buffer | null> {
    try { return Buffer.from((await axios.get(url, { responseType: "arraybuffer", timeout: 8000 })).data); } catch { return null; }
}
function t(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function box(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number, c: string) {
    ctx.fillStyle = c; rr(ctx, x, y, w, h, r); ctx.fill();
}
function icon(ctx: SKRSContext2D, img: any, x: number, y: number, s: number, r = 4) {
    ctx.save(); rr(ctx, x, y, s, s, r); ctx.clip();
    ctx.drawImage(img, x, y, s, s); ctx.restore();
}

async function preload(jobs: [string, string][]): Promise<Map<string, any>> {
    const m = new Map<string, any>();
    await Promise.all(jobs.map(async ([k, url]) => {
        const buf = await fetchBuf(url);
        if (buf) try { m.set(k, await loadImage(buf)); } catch {}
    }));
    return m;
}

function statRow(ctx: SKRSContext2D, x: number, y: number, w: number, name: string, val: string, dot = "#4fc3f7") {
    ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 5, y - 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8d0e0"; ctx.font = `12px ${FONT}`; ctx.fillText(t(name, 18), x + 14, y);
    ctx.fillStyle = "#fff"; ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(val, x + w - ctx.measureText(val).width, y);
}

// Profile picture URLs
function giProfilePic(id: number) { return `${ENKA}UI_AvatarIcon_Side_${id}.png`; }
function hsrProfilePic(headIcon: number) { return `https://enka.network/ui/hsr/SpriteOutput/AvatarRoundIcon/Series/${headIcon}.png`; }


// ═══════════════════════════════════════════════════════════════════════════════
//  GENSHIN IMPACT
// ═══════════════════════════════════════════════════════════════════════════════
const GI_SLOTS = ["Flower", "Plume", "Sands", "Goblet", "Circlet"];

export async function generateGenshinImage(user: EnkaUserData): Promise<Buffer[]> {
    if (!user.characters.length) return [empty(user.nickname, user.uid, "Genshin Impact")];
    const out: Buffer[] = [];
    for (const c of user.characters) try { out.push(await giCard(user, c)); } catch {}
    return out.length ? out : [empty(user.nickname, user.uid, "Genshin Impact")];
}

async function giCard(user: EnkaUserData, char: EnkaCharacter): Promise<Buffer> {
    const jobs: [string, string][] = [];
    if (char.portrait) jobs.push(["port", `${ENKA}${char.portrait}.png`]);
    if (char.weapon?.icon) jobs.push(["wep", `${ENKA}${char.weapon.icon}.png`]);
    for (const a of char.artifacts) if (a.icon) jobs.push([`a_${a.slot}`, `${ENKA}${a.icon}.png`]);
    for (let i = 0; i < Math.min(char.skills.length, 3); i++) if (char.skills[i].icon) jobs.push([`sk${i}`, `${ENKA}${char.skills[i].icon}.png`]);
    for (let i = 0; i < Math.min(char.constellationIcons.length, 6); i++) if (char.constellationIcons[i]) jobs.push([`con${i}`, char.constellationIcons[i]]);
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // Background
    const bg = await loadBg("genshin");
    if (bg) ctx.drawImage(bg, 0, 0, W, H); else { ctx.fillStyle = "#0c1a2a"; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);

    // ═══ LEFT: Full-height portrait ═══
    const portImg = icons.get("port");
    if (portImg) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, LEFT_W, H - FOOTER_H); ctx.clip();
        const s = Math.max(LEFT_W / portImg.width, (H - FOOTER_H) / portImg.height);
        const dw = portImg.width * s, dh = portImg.height * s;
        ctx.drawImage(portImg, (LEFT_W - dw) / 2, (H - FOOTER_H - dh) / 2, dw, dh);
        ctx.restore();
        // Right fade
        const fade = ctx.createLinearGradient(LEFT_W - 80, 0, LEFT_W, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = fade; ctx.fillRect(LEFT_W - 80, 0, 80, H - FOOTER_H);
    }

    // Name bar
    box(ctx, 0, 0, LEFT_W, 48, 0, "rgba(0,0,0,0.6)");
    ctx.fillStyle = "#fff"; ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(char.name ?? "Unknown", 14, 32);
    ctx.fillStyle = "#bbb"; ctx.font = `13px ${FONT}`;
    ctx.fillText(`Lv. ${char.level}`, LEFT_W - 65, 30);

    // Talents (bottom overlay)
    const talY = H - FOOTER_H - 130;
    box(ctx, 8, talY, LEFT_W - 16, 42, 8, "rgba(0,0,0,0.65)");
    ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText("Talents", 16, talY + 12);
    const SKC = ["#4fc3f7", "#66bb6a", "#ffa726"];
    for (let i = 0; i < Math.min(char.skills.length, 3); i++) {
        const sx = 30 + i * 80, sy = talY + 28;
        const si = icons.get(`sk${i}`);
        if (si) { ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.clip(); const sc = 26 / Math.max(si.width, si.height); ctx.drawImage(si, sx - si.width * sc / 2, sy - si.height * sc / 2, si.width * sc, si.height * sc); ctx.restore(); }
        ctx.strokeStyle = SKC[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = SKC[i]; ctx.font = `bold 9px ${FONT}`;
        const lv = String(char.skills[i].level); ctx.fillText(lv, sx + 15, sy + 3);
    }

    // Weapon (below talents)
    const wY = talY + 48;
    box(ctx, 8, wY, LEFT_W - 16, 36, 8, "rgba(0,0,0,0.65)");
    if (char.weapon) {
        const wi = icons.get("wep");
        if (wi) try { icon(ctx, wi, 12, wY + 2, 32, 4); } catch {}
        ctx.fillStyle = "#4fc3f7"; ctx.font = `bold 12px ${FONT}`;
        ctx.fillText(t(char.weapon.name ?? "Unknown", 22), 48, wY + 15);
        ctx.fillStyle = "#8ba0b4"; ctx.font = `11px ${FONT}`;
        ctx.fillText(`Lv.${char.weapon.level} R${char.weapon.refinement} ${"★".repeat(char.weapon.stars)}`, 48, wY + 30);
    }

    // Constellations
    const conY = wY + 42;
    for (let i = 0; i < 6; i++) {
        const cx = 18 + i * 40;
        const active = i < char.constellation;
        ctx.beginPath(); ctx.arc(cx + 13, conY + 13, 13, 0, Math.PI * 2);
        ctx.fillStyle = active ? (char.elementColor ?? "#888") + "cc" : "rgba(0,0,0,0.5)";
        ctx.fill(); ctx.strokeStyle = char.elementColor ?? "#888"; ctx.lineWidth = 1.5; ctx.stroke();
        const ci = icons.get(`con${i}`);
        if (ci) {
            ctx.save(); ctx.beginPath(); ctx.arc(cx + 13, conY + 13, 11, 0, Math.PI * 2); ctx.clip();
            ctx.globalAlpha = active ? 1 : 0.3;
            const s = 22 / Math.max(ci.width, ci.height);
            ctx.drawImage(ci, cx + 13 - ci.width * s / 2, conY + 13 - ci.height * s / 2, ci.width * s, ci.height * s);
            ctx.restore(); ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = "#fff"; ctx.font = `bold 10px ${FONT}`;
            const l = String(i + 1); ctx.fillText(l, cx + 13 - ctx.measureText(l).width / 2, conY + 17);
        }
    }

    // ═══ RIGHT: Stats + Artifacts ═══
    let ry = 10;
    ctx.fillStyle = "#fff"; ctx.font = `bold 20px ${FONT}`;
    ctx.fillText("Character Stats", RX + 10, ry + 22); ry += 36;

    // Stats - dynamic height based on content
    const stats = char.stats;
    const half = Math.ceil(stats.length / 2);
    const statsH = half * 24 + 16;
    box(ctx, RX + 4, ry, RW - 8, statsH, 8, "rgba(0,0,0,0.5)");
    const colW = (RW - 24) / 2;
    for (let i = 0; i < Math.max(half, stats.length - half); i++) {
        const rowY = ry + 14 + i * 24;
        if (stats[i]) statRow(ctx, RX + 12, rowY, colW, stats[i].name, stats[i].value);
        if (stats[i + half]) statRow(ctx, RX + colW + 18, rowY, colW, stats[i + half].name, stats[i + half].value);
    }
    ry += statsH + 10;

    // Artifacts
    ctx.fillStyle = "#fff"; ctx.font = `bold 16px ${FONT}`;
    ctx.fillText("Artifacts", RX + 10, ry + 14); ry += 24;

    const gap = 5, cols = 3, rows = 2;
    const cW = Math.floor((RW - gap * (cols + 1) - 8) / cols);
    const cH = Math.floor((H - FOOTER_H - ry - gap * (rows + 1) - 4) / rows);
    const ordered = GI_SLOTS.map(s => char.artifacts.find(a => a.slot === s) ?? null);

    for (let i = 0; i < 6; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const rx = RX + 4 + gap + col * (cW + gap);
        const rcy = ry + gap + row * (cH + gap);
        const art = i < 5 ? ordered[i] : null;

        box(ctx, rx, rcy, cW, cH, 6, "rgba(0,0,0,0.55)");
        if (!art) { ctx.fillStyle = "#444"; ctx.font = `10px ${FONT}`; const lb = i < 5 ? GI_SLOTS[i] : ""; ctx.fillText(lb, rx + cW / 2 - ctx.measureText(lb).width / 2, rcy + cH / 2); continue; }

        // Header
        box(ctx, rx, rcy, cW, 18, 6, "rgba(80,180,220,0.25)");
        ctx.fillStyle = "rgba(80,180,220,0.25)"; ctx.fillRect(rx, rcy + 12, cW, 6);
        ctx.fillStyle = "#4fc3f7"; ctx.font = `bold 9px ${FONT}`; ctx.fillText(art.slot, rx + 5, rcy + 13);
        ctx.fillStyle = "#ffd700"; const badge = `+${art.level}`; ctx.fillText(badge, rx + cW - ctx.measureText(badge).width - 5, rcy + 13);

        // Icon (inside card, clamped)
        const ai = icons.get(`a_${art.slot}`);
        const iconS = Math.min(30, cH - 50);
        if (ai) try { icon(ctx, ai, rx + cW - iconS - 6, rcy + 20, iconS, 4); } catch {}

        // Main stat
        ctx.fillStyle = "#ffd700"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(art.mainStat.name, rx + 5, rcy + 34);
        ctx.fillStyle = "#fff"; ctx.font = `bold 15px ${FONT}`; ctx.fillText(art.mainStat.value, rx + 5, rcy + 52);

        // Sub stats
        const subStart = rcy + 60;
        const subH = Math.min(17, (cH - 64) / 4);
        for (let si = 0; si < Math.min(art.subStats.length, 4); si++) {
            const sub = art.subStats[si], sy = subStart + si * subH;
            ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText(t(sub.name, 12), rx + 5, sy + 10);
            ctx.fillStyle = "#ddeeff"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(sub.value, rx + cW - ctx.measureText(sub.value).width - 5, sy + 10);
        }
    }

    // Footer
    let pfpImg: any = null;
    if (user.profileIcon) { const buf = await fetchBuf(user.profileIcon); if (buf) try { pfpImg = await loadImage(buf); } catch {} }
    drawFooter(ctx, user.nickname, user.uid, "Genshin Impact · ChisatoBOT", pfpImg);
    return Buffer.from(canvas.toBuffer("image/png"));
}


// ═══════════════════════════════════════════════════════════════════════════════
//  HONKAI: STAR RAIL
// ═══════════════════════════════════════════════════════════════════════════════
const HSR_SLOTS = ["Head", "Hands", "Body", "Feet", "Sphere", "Rope"];

export async function generateHSRImage(user: HSRUserData): Promise<Buffer[]> {
    if (!user.characters.length) return [empty(user.nickname, user.uid, "Honkai: Star Rail")];
    const out: Buffer[] = [];
    for (const c of user.characters) try { out.push(await hsrCard(user, c)); } catch {}
    return out.length ? out : [empty(user.nickname, user.uid, "Honkai: Star Rail")];
}

async function hsrCard(user: HSRUserData, char: HSRCharacter): Promise<Buffer> {
    const jobs: [string, string][] = [];
    if (char.portrait) jobs.push(["port", char.portrait]);
    if (char.lightCone?.icon) jobs.push(["lc", char.lightCone.icon]);
    for (let i = 0; i < Math.min(char.skills.length, 4); i++) if (char.skills[i].icon) jobs.push([`sk${i}`, char.skills[i].icon]);
    for (const r of char.relics) if (r.icon) jobs.push([`r_${r.slotNum}`, r.icon]);
    for (let i = 0; i < Math.min(char.eidolonIcons.length, 6); i++) if (char.eidolonIcons[i]) jobs.push([`eid${i}`, char.eidolonIcons[i]]);
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = await loadBg("hsr");
    if (bg) ctx.drawImage(bg, 0, 0, W, H); else { ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);

    // ═══ LEFT: Portrait ═══
    const portImg = icons.get("port");
    if (portImg) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, LEFT_W, H - FOOTER_H); ctx.clip();
        const s = Math.max(LEFT_W / portImg.width, (H - FOOTER_H) / portImg.height);
        const dw = portImg.width * s, dh = portImg.height * s;
        ctx.drawImage(portImg, (LEFT_W - dw) / 2, (H - FOOTER_H - dh) / 2, dw, dh);
        ctx.restore();
        const fade = ctx.createLinearGradient(LEFT_W - 80, 0, LEFT_W, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = fade; ctx.fillRect(LEFT_W - 80, 0, 80, H - FOOTER_H);
    }

    box(ctx, 0, 0, LEFT_W, 48, 0, "rgba(0,0,0,0.6)");
    ctx.fillStyle = "#fff"; ctx.font = `bold 24px ${FONT}`; ctx.fillText(char.name, 14, 32);
    ctx.fillStyle = "#bbb"; ctx.font = `13px ${FONT}`; ctx.fillText(`Lv. ${char.level}`, LEFT_W - 65, 30);

    // Trace
    const talY = H - FOOTER_H - 130;
    box(ctx, 8, talY, LEFT_W - 16, 42, 8, "rgba(0,0,0,0.65)");
    ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText("Trace", 16, talY + 12);
    const SC = ["#4fc3f7", "#66bb6a", "#ffa726", "#f06292"];
    for (let i = 0; i < Math.min(char.skills.length, 4); i++) {
        const sx = 30 + i * 70, sy = talY + 28;
        const si = icons.get(`sk${i}`);
        if (si) { ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.clip(); const sc = 26 / Math.max(si.width, si.height); ctx.drawImage(si, sx - si.width * sc / 2, sy - si.height * sc / 2, si.width * sc, si.height * sc); ctx.restore(); }
        ctx.strokeStyle = SC[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = SC[i]; ctx.font = `bold 9px ${FONT}`;
        const lv = String(char.skills[i].level); ctx.fillText(lv, sx + 15, sy + 3);
    }

    // Light Cone
    const lcY = talY + 48;
    box(ctx, 8, lcY, LEFT_W - 16, 36, 8, "rgba(0,0,0,0.65)");
    if (char.lightCone) {
        const li = icons.get("lc");
        if (li) try { icon(ctx, li, 12, lcY + 2, 32, 4); } catch {}
        ctx.fillStyle = "#b388ff"; ctx.font = `bold 12px ${FONT}`;
        ctx.fillText(t(char.lightCone.name, 20), 48, lcY + 15);
        ctx.fillStyle = "#8ba0b4"; ctx.font = `11px ${FONT}`;
        ctx.fillText(`Lv.${char.lightCone.level} S${char.lightCone.superimposition}`, 48, lcY + 30);
    }

    // Eidolons
    const eY = lcY + 42;
    for (let i = 0; i < 6; i++) {
        const cx = 18 + i * 40;
        const active = i < char.eidolons;
        ctx.beginPath(); ctx.arc(cx + 13, eY + 13, 13, 0, Math.PI * 2);
        ctx.fillStyle = active ? char.elementColor + "cc" : "rgba(0,0,0,0.5)";
        ctx.fill(); ctx.strokeStyle = char.elementColor; ctx.lineWidth = 1.5; ctx.stroke();
        const ei = icons.get(`eid${i}`);
        if (ei) {
            ctx.save(); ctx.beginPath(); ctx.arc(cx + 13, eY + 13, 11, 0, Math.PI * 2); ctx.clip();
            ctx.globalAlpha = active ? 1 : 0.3;
            const s = 22 / Math.max(ei.width, ei.height);
            ctx.drawImage(ei, cx + 13 - ei.width * s / 2, eY + 13 - ei.height * s / 2, ei.width * s, ei.height * s);
            ctx.restore(); ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = "#fff"; ctx.font = `bold 10px ${FONT}`;
            const l = String(i + 1); ctx.fillText(l, cx + 13 - ctx.measureText(l).width / 2, eY + 17);
        }
    }

    // ═══ RIGHT: Stats + Relics ═══
    let ry = 10;
    ctx.fillStyle = "#fff"; ctx.font = `bold 20px ${FONT}`;
    ctx.fillText("Character Stats", RX + 10, ry + 22); ry += 36;

    // Stats - dynamic height
    const allStats: [string, string][] = char.attributes.map(s => {
        const ex = char.additions?.find(a => a.field === s.field);
        return [s.name, s.display + (ex && ex.value > 0 ? ` (+${ex.display})` : "")] as [string, string];
    });
    const half = Math.ceil(allStats.length / 2);
    const statsH = half * 24 + 16;
    box(ctx, RX + 4, ry, RW - 8, statsH, 8, "rgba(0,0,0,0.5)");
    const colW = (RW - 24) / 2;
    for (let i = 0; i < Math.max(half, allStats.length - half); i++) {
        const rowY = ry + 14 + i * 24;
        if (allStats[i]) statRow(ctx, RX + 12, rowY, colW, allStats[i][0], allStats[i][1]);
        if (allStats[i + half]) statRow(ctx, RX + colW + 18, rowY, colW, allStats[i + half][0], allStats[i + half][1]);
    }
    ry += statsH + 10;

    // Relics
    ctx.fillStyle = "#fff"; ctx.font = `bold 16px ${FONT}`;
    ctx.fillText("Relics", RX + 10, ry + 14); ry += 24;

    const gap = 5, cols = 3, rows = 2;
    const cW = Math.floor((RW - gap * (cols + 1) - 8) / cols);
    const cH = Math.floor((H - FOOTER_H - ry - gap * (rows + 1) - 4) / rows);
    const ordered: (HSRRelic | null)[] = Array.from({ length: 6 }, (_, i) => char.relics.find(r => r.slotNum === i + 1) ?? null);

    for (let i = 0; i < 6; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const rx = RX + 4 + gap + col * (cW + gap);
        const rcy = ry + gap + row * (cH + gap);
        const rel = ordered[i];

        box(ctx, rx, rcy, cW, cH, 6, "rgba(0,0,0,0.55)");
        if (!rel) { ctx.fillStyle = "#444"; ctx.font = `10px ${FONT}`; const lb = HSR_SLOTS[i]; ctx.fillText(lb, rx + cW / 2 - ctx.measureText(lb).width / 2, rcy + cH / 2); continue; }

        // Header
        box(ctx, rx, rcy, cW, 18, 6, "rgba(180,140,60,0.3)");
        ctx.fillStyle = "rgba(180,140,60,0.3)"; ctx.fillRect(rx, rcy + 12, cW, 6);
        ctx.fillStyle = "#ffd700"; ctx.font = `bold 9px ${FONT}`; ctx.fillText(HSR_SLOTS[rel.slotNum - 1], rx + 5, rcy + 13);
        const badge = `+${rel.level}`; ctx.fillText(badge, rx + cW - ctx.measureText(badge).width - 5, rcy + 13);

        // Icon (clamped inside card)
        const ri = icons.get(`r_${rel.slotNum}`);
        const iconS = Math.min(28, cH - 55);
        if (ri) try { icon(ctx, ri, rx + cW - iconS - 5, rcy + 20, iconS, 4); } catch {}

        // Main stat
        ctx.fillStyle = "#ffd700"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(t(rel.mainStat.name, 14), rx + 5, rcy + 34);
        ctx.fillStyle = "#fff"; ctx.font = `bold 15px ${FONT}`; ctx.fillText(rel.mainStat.display, rx + 5, rcy + 52);

        // Sub stats
        const subStart = rcy + 60;
        const subH = Math.min(17, (cH - 64) / 4);
        for (let si = 0; si < Math.min(rel.subStats.length, 4); si++) {
            const sub = rel.subStats[si], sy = subStart + si * subH;
            ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText(t(sub.name, 12), rx + 5, sy + 10);
            ctx.fillStyle = "#ddeeff"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(sub.display, rx + cW - ctx.measureText(sub.display).width - 5, sy + 10);
        }
    }

    let pfpImg: any = null;
    if (user.profileIcon) { const buf = await fetchBuf(user.profileIcon); if (buf) try { pfpImg = await loadImage(buf); } catch {} }
    drawFooter(ctx, user.nickname, user.uid, "Honkai: Star Rail · ChisatoBOT", pfpImg);
    return Buffer.from(canvas.toBuffer("image/png"));
}


// ═══════════════════════════════════════════════════════════════════════════════
//  ZENLESS ZONE ZERO
// ═══════════════════════════════════════════════════════════════════════════════
export async function generateZZZImage(user: ZZZUserData): Promise<Buffer[]> {
    if (!user.agents.length) return [empty(user.nickname, user.uid, "Zenless Zone Zero")];
    const out: Buffer[] = [];
    for (const a of user.agents) try { out.push(await zzzCard(user, a)); } catch {}
    return out.length ? out : [empty(user.nickname, user.uid, "Zenless Zone Zero")];
}

const ZE: Record<string, string> = { Fire: "#ff6030", Ice: "#40d0ff", Electric: "#c080ff", Physical: "#c8c8c8", Ether: "#ff50c0", FireFrost: "#22bdcc" };

async function zzzCard(user: ZZZUserData, agent: ZZZAgent): Promise<Buffer> {
    const ec = (agent.element?.length ? ZE[agent.element[0]] : null) ?? "#ff6b35";
    const jobs: [string, string][] = [];
    if (agent.portrait) jobs.push(["port", agent.portrait]);
    const icons = await preload(jobs);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = await loadBg("zzz");
    if (bg) ctx.drawImage(bg, 0, 0, W, H); else { ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(0, 0, W, H);

    // Portrait
    const portImg = icons.get("port");
    if (portImg) {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, LEFT_W, H - FOOTER_H); ctx.clip();
        const s = Math.max(LEFT_W / portImg.width, (H - FOOTER_H) / portImg.height);
        const dw = portImg.width * s, dh = portImg.height * s;
        ctx.drawImage(portImg, (LEFT_W - dw) / 2, (H - FOOTER_H - dh) / 2, dw, dh);
        ctx.restore();
        const fade = ctx.createLinearGradient(LEFT_W - 80, 0, LEFT_W, 0);
        fade.addColorStop(0, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = fade; ctx.fillRect(LEFT_W - 80, 0, 80, H - FOOTER_H);
    }

    box(ctx, 0, 0, LEFT_W, 48, 0, "rgba(0,0,0,0.6)");
    ctx.fillStyle = "#fff"; ctx.font = `bold 24px ${FONT}`; ctx.fillText(agent.name, 14, 32);
    ctx.fillStyle = "#bbb"; ctx.font = `13px ${FONT}`; ctx.fillText(`Lv. ${agent.level}`, LEFT_W - 65, 30);

    // Skills
    const skY = H - FOOTER_H - 130;
    box(ctx, 8, skY, LEFT_W - 16, 42, 8, "rgba(0,0,0,0.65)");
    ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText("Skills", 16, skY + 12);
    const ZC = ["#4fc3f7", "#ff8060", "#66bb6a", "#ffd54f", "#f06292"];
    const ZL = ["ATK", "Spec", "Dodge", "Asst", "Chain"];
    for (let i = 0; i < Math.min(agent.skillLevels?.length ?? 0, 5); i++) {
        const sx = 24 + i * 58, sy = skY + 28;
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
        ctx.strokeStyle = ZC[i]; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `bold 11px ${FONT}`;
        const lv = String(agent.skillLevels[i]); ctx.fillText(lv, sx - ctx.measureText(lv).width / 2, sy + 4);
        ctx.fillStyle = "#666"; ctx.font = `7px ${FONT}`; ctx.fillText(ZL[i], sx - ctx.measureText(ZL[i]).width / 2, sy + 20);
    }

    // W-Engine
    const weY = skY + 48;
    box(ctx, 8, weY, LEFT_W - 16, 34, 8, "rgba(0,0,0,0.65)");
    if (agent.weapon) {
        ctx.fillStyle = "#ff9060"; ctx.font = `bold 12px ${FONT}`;
        ctx.fillText(t(agent.weapon.name ?? "W-Engine", 24), 14, weY + 14);
        ctx.fillStyle = "#8ba0b4"; ctx.font = `11px ${FONT}`;
        ctx.fillText(`Lv.${agent.weapon.level} ${"★".repeat(agent.weapon.stars)}`, 14, weY + 30);
    }

    // Mindscape
    const msY = weY + 40;
    for (let i = 0; i < 6; i++) {
        const cx = 18 + i * 40;
        ctx.beginPath(); ctx.arc(cx + 13, msY + 13, 13, 0, Math.PI * 2);
        ctx.fillStyle = i < agent.mindscape ? ec + "cc" : "rgba(0,0,0,0.5)";
        ctx.fill(); ctx.strokeStyle = ec; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = `bold 10px ${FONT}`;
        const l = String(i + 1); ctx.fillText(l, cx + 13 - ctx.measureText(l).width / 2, msY + 17);
    }

    // ═══ RIGHT ═══
    let ry = 10;
    ctx.fillStyle = "#fff"; ctx.font = `bold 20px ${FONT}`;
    ctx.fillText("Agent Stats", RX + 10, ry + 22); ry += 36;

    const statList = agent.stats ?? [];
    const half = Math.ceil(statList.length / 2);
    const statsH = Math.max(half, 3) * 24 + 16;
    box(ctx, RX + 4, ry, RW - 8, statsH, 8, "rgba(0,0,0,0.5)");
    const colW = (RW - 24) / 2;
    for (let i = 0; i < Math.max(half, statList.length - half); i++) {
        const rowY = ry + 14 + i * 24;
        if (statList[i]) statRow(ctx, RX + 12, rowY, colW, statList[i].name, statList[i].value, "#ff9060");
        if (statList[i + half]) statRow(ctx, RX + colW + 18, rowY, colW, statList[i + half].name, statList[i + half].value, "#ff9060");
    }
    ry += statsH + 10;

    // Drive Discs
    ctx.fillStyle = "#fff"; ctx.font = `bold 16px ${FONT}`;
    ctx.fillText("Drive Discs", RX + 10, ry + 14); ry += 24;

    const gap = 5, cols = 3, rows = 2;
    const cW = Math.floor((RW - gap * (cols + 1) - 8) / cols);
    const cH = Math.floor((H - FOOTER_H - ry - gap * (rows + 1) - 4) / rows);

    for (let i = 0; i < 6; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        const rx = RX + 4 + gap + col * (cW + gap);
        const rcy = ry + gap + row * (cH + gap);
        const disc = agent.discs?.find(d => d.slot === i + 1) ?? null;

        box(ctx, rx, rcy, cW, cH, 6, "rgba(0,0,0,0.55)");
        if (!disc) { ctx.fillStyle = "#444"; ctx.font = `10px ${FONT}`; const lb = `Drive ${i + 1}`; ctx.fillText(lb, rx + cW / 2 - ctx.measureText(lb).width / 2, rcy + cH / 2); continue; }

        box(ctx, rx, rcy, cW, 18, 6, "rgba(255,107,53,0.3)");
        ctx.fillStyle = "rgba(255,107,53,0.3)"; ctx.fillRect(rx, rcy + 12, cW, 6);
        ctx.fillStyle = "#ff9060"; ctx.font = `bold 9px ${FONT}`; ctx.fillText(`Drive ${disc.slot}`, rx + 5, rcy + 13);
        const badge = `+${disc.level}`; ctx.fillText(badge, rx + cW - ctx.measureText(badge).width - 5, rcy + 13);

        ctx.fillStyle = "#ff9060"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(t(disc.mainStat.name, 14), rx + 5, rcy + 34);
        ctx.fillStyle = "#fff"; ctx.font = `bold 15px ${FONT}`; ctx.fillText(disc.mainStat.value, rx + 5, rcy + 52);

        const subStart = rcy + 60;
        const subH = Math.min(17, (cH - 64) / 4);
        for (let si = 0; si < Math.min(disc.subStats.length, 4); si++) {
            const sub = disc.subStats[si], sy = subStart + si * subH;
            ctx.fillStyle = "#8ba0b4"; ctx.font = `10px ${FONT}`; ctx.fillText(t(sub.name, 12), rx + 5, sy + 10);
            ctx.fillStyle = "#ffeedd"; ctx.font = `bold 10px ${FONT}`; ctx.fillText(sub.value, rx + cW - ctx.measureText(sub.value).width - 5, sy + 10);
        }
    }

    let pfpImg: any = null;
    if (user.profileIcon) { const buf = await fetchBuf(user.profileIcon); if (buf) try { pfpImg = await loadImage(buf); } catch {} }
    drawFooter(ctx, user.nickname, user.uid, "Zenless Zone Zero · ChisatoBOT", pfpImg);
    return Buffer.from(canvas.toBuffer("image/png"));
}

// Footer & Empty Card

function drawFooter(ctx: SKRSContext2D, nickname: string, uid: number, credit: string, pfpImg?: any) {
    ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
    let textX = 14;
    // Profile icon (circle)
    if (pfpImg) {
        const s = FOOTER_H - 12, cy = H - FOOTER_H + 6;
        ctx.save(); ctx.beginPath(); ctx.arc(textX + s / 2, cy + s / 2, s / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(pfpImg, textX, cy, s, s); ctx.restore();
        textX += s + 10;
    }
    ctx.fillStyle = "#777"; ctx.font = `10px ${FONT}`; ctx.fillText("From:", textX, H - 34);
    ctx.fillStyle = "#fff"; ctx.font = `bold 14px ${FONT}`; ctx.fillText(nickname, textX, H - 16);
    const nameW = ctx.measureText(nickname).width;
    ctx.fillStyle = "#666"; ctx.font = `12px ${FONT}`; ctx.fillText(`UID:${uid}`, textX + nameW + 14, H - 16);
    ctx.fillStyle = "#555"; ctx.font = `10px ${FONT}`;
    ctx.fillText(credit, W - ctx.measureText(credit).width - 12, H - 16);
}

function empty(nickname: string, uid: number, game: string): Buffer {
    const canvas = createCanvas(700, 100);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0c1a2a"; ctx.fillRect(0, 0, 700, 100);
    ctx.fillStyle = "#fff"; ctx.font = `bold 20px ${FONT}`; ctx.fillText(nickname, 20, 36);
    ctx.fillStyle = "#888"; ctx.font = `13px ${FONT}`; ctx.fillText(`UID: ${uid} · ${game}`, 20, 60);
    ctx.fillStyle = "#555"; ctx.font = `12px ${FONT}`; ctx.fillText("Showcase is empty or private.", 20, 84);
    return Buffer.from(canvas.toBuffer("image/png"));
}
