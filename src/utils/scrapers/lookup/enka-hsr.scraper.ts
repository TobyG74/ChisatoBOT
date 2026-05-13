import axios from "axios";
import type {
    HSRCharacter, HSRUserData, HSRLightCone, HSRSkill,
    HSRRelic, HSRRelicSubStat, HSRStatEntry,
} from "../../../types/lookup/hsr";

export type { HSRCharacter, HSRUserData };

const ENKA_BASE = "https://enka.network";
const STORE_BASE = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/hsr";
const UA = "ChisatoBOT/1.0";
const TIMEOUT = 15000;
const CACHE_TTL = 60 * 60 * 1000;

interface TTLCache<T> { value: T; expiresAt: number; }

let avatarsCache: TTLCache<any> | null = null;
let locCache: TTLCache<Record<string, string>> | null = null;
let weaponsCache: TTLCache<any> | null = null;
let relicsCache: TTLCache<any> | null = null;
let skillsCache: TTLCache<any> | null = null;
let ranksCache: TTLCache<any> | null = null;

async function getAvatars() {
    if (avatarsCache && Date.now() < avatarsCache.expiresAt) return avatarsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/avatars.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    avatarsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}
async function getLoc() {
    if (locCache && Date.now() < locCache.expiresAt) return locCache.value;
    const { data } = await axios.get(`${STORE_BASE}/hsr.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    locCache = { value: data.en, expiresAt: Date.now() + CACHE_TTL };
    return locCache.value;
}
async function getWeapons() {
    if (weaponsCache && Date.now() < weaponsCache.expiresAt) return weaponsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/weapons.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    weaponsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}
async function getRelics() {
    if (relicsCache && Date.now() < relicsCache.expiresAt) return relicsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/relics.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    relicsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}
async function getSkills() {
    if (skillsCache && Date.now() < skillsCache.expiresAt) return skillsCache.value;
    const { data } = await axios.get(`${STORE_BASE}/skills.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    skillsCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}
async function getRanks() {
    if (ranksCache && Date.now() < ranksCache.expiresAt) return ranksCache.value;
    const { data } = await axios.get(`${STORE_BASE}/ranks.json`, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
    ranksCache = { value: data, expiresAt: Date.now() + CACHE_TTL };
    return data;
}

// Stat property display names
const PROP_NAMES: Record<string, [string, boolean]> = {
    HPDelta: ["HP", false], HPAddedRatio: ["HP%", true],
    AttackDelta: ["ATK", false], AttackAddedRatio: ["ATK%", true],
    DefenceDelta: ["DEF", false], DefenceAddedRatio: ["DEF%", true],
    SpeedDelta: ["SPD", false], SpeedAddedRatio: ["SPD%", true],
    CriticalChance: ["CRIT Rate", true], CriticalChanceBase: ["CRIT Rate", true],
    CriticalDamage: ["CRIT DMG", true], CriticalDamageBase: ["CRIT DMG", true],
    BreakDamageAddedRatio: ["Break Effect", true], BreakDamageAddedRatioBase: ["Break Effect", true],
    HealRatioBase: ["Outgoing Heal", true],
    StatusProbability: ["Effect Hit Rate", true], StatusProbabilityBase: ["Effect Hit Rate", true],
    StatusResistance: ["Effect RES", true], StatusResistanceBase: ["Effect RES", true],
    SPRatioBase: ["Energy Regen", true],
    PhysicalAddedRatio: ["Physical DMG%", true], FireAddedRatio: ["Fire DMG%", true],
    IceAddedRatio: ["Ice DMG%", true], ThunderAddedRatio: ["Lightning DMG%", true],
    WindAddedRatio: ["Wind DMG%", true], QuantumAddedRatio: ["Quantum DMG%", true],
    ImaginaryAddedRatio: ["Imaginary DMG%", true],
    BaseHP: ["Base HP", false], BaseAttack: ["Base ATK", false], BaseDefence: ["Base DEF", false],
    BaseSpeed: ["Base SPD", false],
};

function formatProp(type: string, value: number): { name: string; display: string; field: string; value: number; percent: boolean; icon: string } {
    const info = PROP_NAMES[type];
    const name = info?.[0] ?? type;
    const pct = info?.[1] ?? false;
    const display = pct ? `${(value * 100).toFixed(1)}%` : Math.round(value).toLocaleString();
    return { name, display, field: type, value, percent: pct, icon: "" };
}

const ELEMENT_MAP: Record<string, [string, string]> = {
    Fire: ["Fire", "#f4634e"], Ice: ["Ice", "#47c7fd"], Thunder: ["Lightning", "#c580ff"],
    Wind: ["Wind", "#47e5b5"], Physical: ["Physical", "#c8c8c8"],
    Quantum: ["Quantum", "#6e6eff"], Imaginary: ["Imaginary", "#f5e663"],
};
const PATH_MAP: Record<string, string> = {
    Warrior: "Destruction", Rogue: "The Hunt", Mage: "Erudition",
    Shaman: "Harmony", Warlock: "Nihility", Knight: "Preservation",
    Priest: "Abundance", Unknown: "Unknown",
};

export async function fetchHSRUser(uid: string | number): Promise<HSRUserData> {
    if (isNaN(Number(uid))) throw new Error("UID harus berupa angka.");

    const resp = await axios.get(`${ENKA_BASE}/api/hsr/uid/${uid}`, {
        headers: { "User-Agent": UA }, timeout: TIMEOUT,
    }).catch((e) => e.response ? e.response : (() => { throw e; })());

    const { status, data } = resp;
    if (status === 400) throw new Error("Format UID tidak valid.");
    if (status === 404) throw new Error("Player tidak ditemukan.");
    if (status === 424) throw new Error("Enka.Network sedang maintenance.");
    if (status === 429) throw new Error("Rate limit tercapai. Coba lagi nanti.");
    if (status !== 200) throw new Error(`Request gagal: ${status}`);

    const info = data.detailInfo ?? {};
    const [avatars, loc, weapons, relicStore, skillStore, rankStore] = await Promise.all([
        getAvatars(), getLoc(), getWeapons(), getRelics(), getSkills(), getRanks()
    ]);

    const characters: HSRCharacter[] = (info.avatarDetailList ?? []).map((c: any) => {
        const charData = avatars[String(c.avatarId)];
        const nameHash = charData?.AvatarName?.Hash;
        const name = nameHash ? (loc[nameHash] ?? `ID:${c.avatarId}`) : `ID:${c.avatarId}`;
        const elem = ELEMENT_MAP[charData?.Element ?? ""] ?? ["Unknown", "#ffffff"];
        const pathKey = charData?.AvatarBaseType ?? "Unknown";
        const rarity = charData?.Rarity ?? 4;
        const portrait = charData?.AvatarCutinFrontImgPath
            ? `${ENKA_BASE}${charData.AvatarCutinFrontImgPath}`
            : "";

        // Skills (first 4 from skillTreeList matching x001-x004 pattern)
        const skills: HSRSkill[] = [];
        const skillList: any[] = c.skillTreeList ?? [];
        const mainSkillIds = (charData?.SkillList ?? []).slice(0, 4);
        for (let i = 0; i < Math.min(mainSkillIds.length, 4); i++) {
            const pointId = `${c.avatarId}00${i + 1}`;
            const found = skillList.find((s: any) => String(s.pointId) === pointId);
            // skills.json uses 7-digit IDs: charId + "00" + skillNum (e.g. 1403 → 1403001)
            const skillStoreId = `${c.avatarId}00${i + 1}`;
            const skillData = skillStore[skillStoreId];
            skills.push({
                id: String(mainSkillIds[i] ?? ""),
                name: ["Basic", "Skill", "Ultimate", "Talent"][i] ?? `Skill ${i + 1}`,
                level: found?.level ?? 1,
                maxLevel: 10,
                typeText: ["Normal", "BPSkill", "Ultra", "Talent"][i] ?? "",
                icon: skillData?.IconPath ? `${ENKA_BASE}${skillData.IconPath}` : "",
            });
        }

        // Light Cone
        let lightCone: HSRLightCone | null = null;
        if (c.equipment) {
            const eq = c.equipment;
            const wepData = weapons[String(eq.tid)];
            const wepHash = wepData?.EquipmentName?.Hash;
            const wepName = wepHash ? (loc[wepHash] ?? `LC:${eq.tid}`) : `LC:${eq.tid}`;
            const flatProps: any[] = eq._flat?.props ?? [];
            lightCone = {
                id: String(eq.tid),
                name: wepName,
                level: eq.level ?? 1,
                superimposition: eq.rank ?? 1,
                rarity: wepData?.Rarity ?? 3,
                icon: wepData?.ImagePath ? `${ENKA_BASE}${wepData.ImagePath}` : "",
                hp: flatProps.find(p => p.type === "BaseHP")?.value ? Math.round(flatProps.find(p => p.type === "BaseHP").value).toString() : null,
                atk: flatProps.find(p => p.type === "BaseAttack")?.value ? Math.round(flatProps.find(p => p.type === "BaseAttack").value).toString() : null,
                def: flatProps.find(p => p.type === "BaseDefence")?.value ? Math.round(flatProps.find(p => p.type === "BaseDefence").value).toString() : null,
                bonus: null,
            };
        }

        // Relics
        const relics: HSRRelic[] = (c.relicList ?? []).map((r: any): HSRRelic => {
            const flatProps: any[] = r._flat?.props ?? [];
            const mainProp = flatProps[0];
            const subProps = flatProps.slice(1);
            const setHash = r._flat?.setName;
            const setName = setHash ? (loc[String(setHash)] ?? "") : "";
            const relicItem = relicStore?.Items?.[String(r.tid)];
            const relicIcon = relicItem?.Icon ? `${ENKA_BASE}${relicItem.Icon}` : "";

            return {
                id: String(r.tid),
                name: "",
                setName,
                slotNum: r.type ?? 0,
                rarity: relicItem?.Rarity ?? 5,
                level: r.level ?? 0,
                icon: relicIcon,
                mainStat: mainProp ? formatProp(mainProp.type, mainProp.value) : { name: "", display: "", field: "", value: 0, percent: false, icon: "" },
                subStats: subProps.map((s: any): HSRRelicSubStat => {
                    const info = PROP_NAMES[s.type];
                    const pct = info?.[1] ?? false;
                    return {
                        name: info?.[0] ?? s.type,
                        display: pct ? `${(s.value * 100).toFixed(1)}%` : Math.round(s.value).toString(),
                        percent: pct,
                        count: 0,
                    };
                }),
            };
        });
        relics.sort((a, b) => a.slotNum - b.slotNum);

        // Attributes (from promotion data in store)
        const promo = charData?.Promotion?.[String(c.promotion ?? 0)];
        const attributes: HSRStatEntry[] = [];
        if (promo) {
            const lvl = c.level ?? 80;
            const hp = Math.round(promo.HPBase + promo.HPAdd * (lvl - 1));
            const atk = Math.round(promo.AttackBase + promo.AttackAdd * (lvl - 1));
            const def = Math.round(promo.DefenceBase + promo.DefenceAdd * (lvl - 1));
            attributes.push(
                { field: "hp", name: "Base HP", display: hp.toLocaleString(), value: hp, percent: false, icon: "" },
                { field: "atk", name: "Base ATK", display: atk.toLocaleString(), value: atk, percent: false, icon: "" },
                { field: "def", name: "Base DEF", display: def.toLocaleString(), value: def, percent: false, icon: "" },
                { field: "spd", name: "SPD", display: String(promo.SpeedBase ?? 0), value: promo.SpeedBase ?? 0, percent: false, icon: "" },
                { field: "crit_rate", name: "CRIT Rate", display: `${((promo.CriticalChance ?? 0.05) * 100).toFixed(1)}%`, value: promo.CriticalChance ?? 0.05, percent: true, icon: "" },
                { field: "crit_dmg", name: "CRIT DMG", display: `${((promo.CriticalDamage ?? 0.5) * 100).toFixed(1)}%`, value: promo.CriticalDamage ?? 0.5, percent: true, icon: "" },
            );
        }

        return {
            avatarId: c.avatarId,
            name,
            level: c.level ?? 0,
            maxLevel: Math.min(20 + (c.promotion ?? 0) * 10, 80),
            promotion: c.promotion ?? 0,
            eidolons: c.rank ?? 0,
            eidolonIcons: (charData?.RankIDList ?? []).map((rid: number) => {
                const rank = rankStore[String(rid)];
                return rank?.IconPath ? `${ENKA_BASE}${rank.IconPath}` : "";
            }),
            element: elem[0],
            elementColor: elem[1],
            path: PATH_MAP[pathKey] ?? pathKey,
            rarity,
            portrait,
            lightCone,
            skills,
            relics,
            attributes,
            additions: [],
        };
    });

    // Profile picture
    const headIcon = info.headIcon;
    const profileIcon = headIcon
        ? `${ENKA_BASE}/ui/hsr/SpriteOutput/AvatarRoundIcon/Series/${headIcon}.png`
        : null;

    return {
        uid: Number(uid),
        nickname: info.nickname ?? "Unknown",
        signature: info.signature ?? null,
        level: info.level ?? 0,
        worldLevel: info.worldLevel ?? 0,
        profileIcon,
        characters,
        url: `${ENKA_BASE}/hsr/${uid}/`,
    };
}


// List all characters / weapons

export interface HSRCharInfo { id: string; name: string; element: string; path: string; rarity: number; }
export interface HSRWeaponInfo { id: string; name: string; path: string; rarity: number; }

export async function fetchAllHSRCharacters(): Promise<HSRCharInfo[]> {
    const [avatars, loc] = await Promise.all([getAvatars(), getLoc()]);
    const result: HSRCharInfo[] = [];
    for (const [id, char] of Object.entries(avatars) as [string, any][]) {
        const hash = char.AvatarName?.Hash;
        const name = hash ? (loc[hash] ?? null) : null;
        if (!name) continue;
        const elem = ELEMENT_MAP[char.Element ?? ""]?.[0] ?? char.Element ?? "Unknown";
        const path = PATH_MAP[char.AvatarBaseType ?? ""] ?? char.AvatarBaseType ?? "Unknown";
        result.push({ id, name, element: elem, path, rarity: char.Rarity ?? 4 });
    }
    return result.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}

export async function fetchAllHSRWeapons(): Promise<HSRWeaponInfo[]> {
    const [weapons, loc] = await Promise.all([getWeapons(), getLoc()]);
    const result: HSRWeaponInfo[] = [];
    for (const [id, wep] of Object.entries(weapons) as [string, any][]) {
        const hash = wep.EquipmentName?.Hash;
        const name = hash ? (loc[hash] ?? null) : null;
        if (!name) continue;
        const path = PATH_MAP[wep.AvatarBaseType ?? ""] ?? wep.AvatarBaseType ?? "Unknown";
        result.push({ id, name, path, rarity: wep.Rarity ?? 3 });
    }
    return result.sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}
