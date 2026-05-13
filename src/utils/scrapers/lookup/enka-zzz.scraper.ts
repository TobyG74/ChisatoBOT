import axios from "axios";
import type { ZZZAgent, ZZZDisc, ZZZDiscStat, ZZZStat, ZZZUserData } from "../../../types/lookup/zzz";

export type { ZZZAgent, ZZZUserData };

const ENKA_BASE = "https://enka.network";
const STORE_BASE = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/zzz";
const UA = "ChisatoBOT/1.0";
const TIMEOUT = 15000;
const CACHE_TTL = 60 * 60 * 1000;

// TTLCache pattern aligned with project conventions
interface TTLCache<T> { value: T; expiresAt: number; }

let avatarsCache: TTLCache<any> | null = null;
let weaponsCache: TTLCache<any> | null = null;
let equipmentCache: TTLCache<any> | null = null;
let pfpsCache: TTLCache<any> | null = null;

async function getAvatars(): Promise<any> {
    if (avatarsCache && Date.now() < avatarsCache.expiresAt) return avatarsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/avatars.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    avatarsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}

async function getWeapons(): Promise<any> {
    if (weaponsCache && Date.now() < weaponsCache.expiresAt) return weaponsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/weapons.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    weaponsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}

async function getEquipment(): Promise<any> {
    if (equipmentCache && Date.now() < equipmentCache.expiresAt) return equipmentCache.value;
    try {
        const { data } = await axios.get(`${STORE_BASE}/equipment.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
        equipmentCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
        return data;
    } catch { return {}; }
}

// ZZZ property ID → [displayName, isPercent]
// Based on Enka ZZZ API property IDs
const ZZZ_PROP_MAP: Record<number, [string, boolean]> = {
    // Base stats
    11101: ["HP",               false], 11102: ["HP%",              true],  11103: ["HP",               false],
    11104: ["HP%",              true],  11105: ["HP",               false],
    12101: ["ATK",              false], 12102: ["ATK%",             true],  12103: ["ATK",              false],
    13101: ["DEF",              false], 13102: ["DEF%",             true],  13103: ["DEF",              false],
    // Crit
    20101: ["CRIT Rate",        true],  20103: ["CRIT Rate",        true],
    21101: ["CRIT DMG",         true],  21103: ["CRIT DMG",         true],
    // Impact / Stun
    12201: ["Impact",           false], 12202: ["Impact%",          true],  12203: ["Impact",           false],
    // PEN
    23101: ["PEN Ratio",        true],  23103: ["PEN Ratio",        true],
    23201: ["PEN",              false], 23203: ["PEN",              false],
    // Energy
    30501: ["Energy Regen",     false], 30502: ["Energy Regen%",    true],  30503: ["Energy Regen",     false],
    // Anomaly
    31201: ["Anomaly Mastery",  false], 31203: ["Anomaly Mastery",  false],
    31401: ["Anomaly Prof.",    false], 31402: ["Anomaly Prof.%",   true],  31403: ["Anomaly Prof.",    false],
    // Elemental DMG
    31501: ["Physical DMG%",    true],  31503: ["Physical DMG%",    true],
    31601: ["Fire DMG%",        true],  31603: ["Fire DMG%",        true],
    31701: ["Ice DMG%",         true],  31703: ["Ice DMG%",         true],
    31801: ["Electric DMG%",    true],  31803: ["Electric DMG%",    true],
    31901: ["Ether DMG%",       true],  31903: ["Ether DMG%",       true],
    // Other
    32001: ["RP Regen",         false],
};

function formatZZZProp(propId: number, rawValue: number): ZZZDiscStat | ZZZStat {
    const info = ZZZ_PROP_MAP[propId];
    const name = info ? info[0] : `Prop #${propId}`;
    const isPercent = info ? info[1] : false;
    // ZZZ API: percent values are stored as value*100 (e.g. 480 = 4.8%)
    const value = isPercent
        ? `${(rawValue / 100).toFixed(1)}%`
        : Math.round(rawValue).toLocaleString();
    return { name, value };
}

function extractAgentName(charData: any, id: number): string {
    if (!charData) return `ID:${id}`;
    // Try Name field, then Code field, then ID
    const raw: string = charData.Name ?? charData.Code ?? String(id);
    // Strip internal prefix like "Avatar_Female_Size02_" → take last segment
    const parts = raw.split("_");
    return parts[parts.length - 1] || raw;
}

async function getZZZPfps(): Promise<any> {
    if (pfpsCache && Date.now() < pfpsCache.expiresAt) return pfpsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/pfps.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    pfpsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}

export async function fetchZZZUser(uid: string | number): Promise<ZZZUserData> {
    if (isNaN(Number(uid))) throw new Error("UID harus berupa angka.");

    const [apiResult, storeData] = await Promise.all([
        axios.get(`${ENKA_BASE}/api/zzz/uid/${uid}`, {
            headers: { "User-Agent": UA }, timeout: TIMEOUT,
        }).catch((e) => e.response ? e.response : (() => { throw e; })()),
        Promise.all([getAvatars(), getWeapons(), getEquipment()]).catch(() => [null, null, null]),
    ]);

    const { data, status } = apiResult;
    if (status === 400) throw new Error("Format UID tidak valid.");
    if (status === 404) throw new Error("Player tidak ditemukan.");
    if (status === 424) throw new Error("Enka.Network sedang maintenance.");
    if (status === 429) throw new Error("Rate limit tercapai. Coba lagi nanti.");
    if (status !== 200) throw new Error(`Request gagal: ${status}`);

    const [avatars, weapons, equipment] = storeData as [any, any, any] | [null, null, null];
    const profile = data.PlayerInfo?.SocialDetail?.ProfileDetail ?? {};
    const showcase: any[] = data.PlayerInfo?.ShowcaseDetail?.AvatarList ?? [];

    const agents: ZZZAgent[] = showcase.map((a: any) => {
        const charData = avatars ? (avatars[String(a.Id)] ?? null) : null;
        const name = extractAgentName(charData, a.Id);

        // Portrait: use CircleIcon or Image from store
        const portrait = charData?.Image ? `${ENKA_BASE}${charData.Image}` : null;

        // W-Engine
        let weapon: ZZZAgent["weapon"] = null;
        if (a.Weapon) {
            const wepData = weapons ? (weapons[String(a.Weapon.Id)] ?? null) : null;
            // ItemName is a loc key like "Item_Weapon_S_1091_Name" - not useful
            // Use agent name as context for signature weapon, or show W-Engine ID
            const wepName = wepData?.ItemName && !wepData.ItemName.startsWith("Item_")
                ? wepData.ItemName
                : `W-Engine #${a.Weapon.Id}`;
            weapon = {
                id: a.Weapon.Id,
                name: wepName,
                level: a.Weapon.Level ?? 0,
                stars: (wepData?.Rarity ?? 2) + 1,
                refine: a.Weapon.UpgradeLevel ?? 1,
            };
        }

        // Stats from store BaseProps (no PropertyList in Enka response)
        const stats: ZZZStat[] = [];
        if (charData?.BaseProps) {
            for (const [propId, val] of Object.entries(charData.BaseProps)) {
                if (Number(val) > 0) stats.push(formatZZZProp(Number(propId), Number(val)));
            }
        }

        // Disc drives from EquippedList
        const discs: ZZZDisc[] = [];
        for (const entry of (a.EquippedList ?? [])) {
            const slot: number = entry.Slot ?? 0;
            const eq = entry.Equipment;
            if (!eq) continue;

            const itemId: number = eq.Id ?? 0;
            const level: number = eq.Level ?? 0;

            // Set name from equipment store: Items → SuitId → Suits → Icon name
            const eqItem = equipment?.Items?.[String(itemId)];
            const suitId = eqItem?.SuitId;
            const suitData = suitId ? equipment?.Suits?.[String(suitId)] : null;
            // Extract readable name from icon path: "/ui/zzz/SuitWoodpeckerElectro.png" → "Woodpecker Electro"
            let setName = `Set ${String(itemId).slice(0, 3)}`;
            if (suitData?.Icon) {
                const match = suitData.Icon.match(/Suit(.+)\.png$/);
                if (match) setName = match[1].replace(/([A-Z])/g, " $1").trim();
            }
            const rarity = (eqItem?.Rarity ?? 3) + 1;

            // Main stat
            const mainRaw = (eq.MainPropertyList ?? [])[0];
            const mainStat: ZZZDiscStat = mainRaw
                ? formatZZZProp(mainRaw.PropertyId ?? 0, mainRaw.PropertyValue ?? 0)
                : { name: "Unknown", value: "—" };

            // Sub stats
            const subStats: ZZZDiscStat[] = (eq.RandomPropertyList ?? []).map((p: any) =>
                formatZZZProp(p.PropertyId ?? 0, p.PropertyValue ?? 0)
            );

            if (slot >= 1 && slot <= 6) {
                discs.push({ slot, setName, rarity, level, mainStat, subStats });
            }
        }
        discs.sort((a, b) => a.slot - b.slot);

        // Skill levels from SkillLevelList [{Level, Index}]
        // Index: 0=Normal ATK, 1=Special, 2=Dodge, 3=Chain, 5=Core, 6=Assist
        // Display order: ATK, Special, Dodge, Assist, Chain
        const skillMap: Record<number, number> = { 0: 0, 1: 1, 2: 2, 6: 3, 3: 4 };
        const skillLevels: number[] = [1, 1, 1, 1, 1];
        for (const sk of (a.SkillLevelList ?? [])) {
            const idx = sk.Index ?? -1;
            const slot = skillMap[idx];
            if (slot !== undefined) skillLevels[slot] = sk.Level ?? 1;
        }

        return {
            id: a.Id,
            name,
            level: a.Level ?? 0,
            promotion: a.PromotionLevel ?? 0,
            mindscape: a.TalentLevel ?? 0,
            coreSkill: a.CoreSkillEnhancement ?? 0,
            rarity: charData?.Rarity != null ? charData.Rarity + 1 : 4,
            element: charData?.ElementTypes ?? [],
            specialty: charData?.ProfessionType ?? "Unknown",
            portrait,
            weapon,
            stats,
            discs,
            skillLevels,
        };
    });

    // Profile picture: ProfileId → need pfps store mapping
    // For now use avatar icon from the store if available
    const profileId = profile.ProfileId;
    let profileIcon: string | null = null;
    if (profileId) {
        try {
            const pfps = await getZZZPfps();
            const pfp = pfps[String(profileId)];
            if (pfp?.Icon) profileIcon = `https://enka.network${pfp.Icon}`;
        } catch {}
    }

    return {
        uid: Number(uid),
        nickname: profile.Nickname || "Unknown",
        description: data.PlayerInfo?.SocialDetail?.Desc ?? null,
        level: profile.Level ?? 0,
        profileIcon,
        agents,
        url: `${ENKA_BASE}/zzz/${uid}/`,
    };
}


// List all agents / weapons

export interface ZZZAgentInfo { id: string; name: string; element: string[]; specialty: string; rarity: number; }
export interface ZZZWeaponInfo { id: string; name: string; specialty: string; rarity: number; }

export async function fetchAllZZZAgents(): Promise<ZZZAgentInfo[]> {
    const avatars = await getAvatars();
    const result: ZZZAgentInfo[] = [];
    for (const [id, char] of Object.entries(avatars) as [string, any][]) {
        const name = extractAgentName(char, Number(id));
        result.push({
            id, name,
            element: char.ElementTypes ?? [],
            specialty: char.ProfessionType ?? "Unknown",
            rarity: (char.Rarity ?? 3) + 1,
        });
    }
    return result.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}

export async function fetchAllZZZWeapons(): Promise<ZZZWeaponInfo[]> {
    const weapons = await getWeapons();
    const result: ZZZWeaponInfo[] = [];
    for (const [id, wep] of Object.entries(weapons) as [string, any][]) {
        // ItemName is a loc key, extract readable part or use ID
        const raw: string = wep.ItemName ?? "";
        const name = raw.startsWith("Item_") ? `W-Engine #${id}` : raw;
        result.push({
            id, name,
            specialty: wep.ProfessionType ?? "Unknown",
            rarity: (wep.Rarity ?? 2) + 1,
        });
    }
    return result.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}
