import axios from "axios";
import { readFileSync, existsSync, writeFileSync, statSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { EnkaArtifact, EnkaArtifactStat, EnkaCharacter, EnkaUserData, GenshinCharacterInfo, GenshinWeaponInfo } from "../../../types/lookup/enka";
import type { AxiosResponse } from "axios";

const ENKA_BASE_URL = "https://enka.network";
const ENKA_STORE_URL = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store";
const USER_AGENT = "enka-system";
const REQUEST_TIMEOUT = 10000;

const elementMap: Record<string, string> = {
    Fire: "Pyro", Ice: "Cryo", Water: "Hydro",
    Wind: "Anemo", Electric: "Electro", Rock: "Geo", Grass: "Dendro",
};

const weaponTypeMap: Record<string, string> = {
    WEAPON_SWORD_ONE_HAND: "Sword", WEAPON_CLAYMORE: "Claymore",
    WEAPON_POLE: "Polearm", WEAPON_BOW: "Bow", WEAPON_CATALYST: "Catalyst",
};

interface TTLCache<T> {
    value: T;
    expiresAt: number;
}

const STORE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Cache store data
let charactersCache: TTLCache<any> | null = null;
let locCache: TTLCache<Record<string, string>> | null = null;

async function getStoreData(file: string) {
    const { data } = await axios.get(`${ENKA_STORE_URL}/${file}`, {
        headers: { "User-Agent": USER_AGENT }, timeout: REQUEST_TIMEOUT,
    });
    return data;
}

async function getLocData(): Promise<Record<string, string>> {
    if (locCache && Date.now() < locCache.expiresAt) return locCache.value;
    const data = await getStoreData("loc.json");
    locCache = { value: data.en, expiresAt: Date.now() + STORE_CACHE_TTL };
    return locCache.value;
}

async function getCharactersData() {
    if (charactersCache && Date.now() < charactersCache.expiresAt) return charactersCache.value;
    const data = await getStoreData("characters.json");
    charactersCache = { value: data, expiresAt: Date.now() + STORE_CACHE_TTL };
    return charactersCache.value;
}

/** Extract character/weapon/pfp data from the live LodaHoyoView bundle, which is updated immediately on game patches. */
interface GiSupplement {
    characters: Record<string, any>;
    weapons: Record<string, any>;
    pfps: Record<string, string>;     // pfpId → bare iconName (e.g. "UI_AvatarIcon_Linnea")
}
let supplementCache: TTLCache<GiSupplement | null> | null = null;

/** Extract a balanced JS object starting at the `{` at position `start`. */
function extractJsObject(str: string, start: number): string | null {
    let depth = 0;
    let inString = false;
    let stringChar = "";
    let i = start;
    while (i < str.length) {
        const ch = str[i];
        if (inString) {
            if (ch === "\\") { i += 2; continue; }
            if (ch === stringChar) inString = false;
        } else {
            if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
            else if (ch === "{") depth++;
            else if (ch === "}") { depth--; if (depth === 0) return str.slice(start, i + 1); }
        }
        i++;
    }
    return null;
}

/** Strip "/ui/" prefix and ".png" suffix from an Enka icon path. */
function normPath(p: string | null | undefined): string | null {
    if (!p || p === "None") return p ?? null;
    return p.replace(/^\/ui\//, "").replace(/\.png$/, "");
}

/** Parse characters and weapons from the raw JS bundle text. */
function parseBundleData(content: string): GiSupplement {
    const characters: Record<string, any> = {};
    const weapons: Record<string, any> = {};

    // Characters: avatarId pattern 1000XXXX
    const charRe = /\b(1000\d{4})\s*:\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = charRe.exec(content)) !== null) {
        const avatarId = m[1];
        const objStr = extractJsObject(content, m.index + m[0].length - 1);
        if (!objStr) continue;

        const element     = (objStr.match(/"?Element"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const sideIcon    = (objStr.match(/"?SideIconName"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const quality     = (objStr.match(/"?QualityType"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const weaponType  = (objStr.match(/"?WeaponType"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const nameHashStr = (objStr.match(/"?NameTextMapHash"?\s*:\s*(\d+)/) || [])[1] ?? null;

        const skillOrderMatch = objStr.match(/"?SkillOrder"?\s*:\s*\[([^\]]*)\]/);
        const skillOrder = skillOrderMatch
            ? skillOrderMatch[1].split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        const skills: Record<string, string> = {};
        const skillsMatch = objStr.match(/"?Skills"?\s*:\s*(\{[^}]*\})/);
        if (skillsMatch) {
            const kp = /(\d+)\s*:\s*"([^"]+)"/g;
            let km: RegExpExecArray | null;
            while ((km = kp.exec(skillsMatch[1])) !== null)
                skills[km[1]] = normPath(km[2]) ?? km[2];
        }

        const consts: string[] = [];
        const constsMatch = objStr.match(/"?Consts"?\s*:\s*(\[[^\]]*\])/);
        if (constsMatch) {
            const cp = /"([^"]+)"/g;
            let km: RegExpExecArray | null;
            while ((km = cp.exec(constsMatch[1])) !== null)
                consts.push(normPath(km[1]) ?? km[1]);
        }

        // Derive readable name from SideIconName: "UI_AvatarIcon_Side_Hu_tao" → "Hu Tao"
        const bareIcon = normPath(sideIcon) ?? "";
        const sideSuffix = bareIcon.replace(/^UI_AvatarIcon_Side_/, "");
        const derivedName = sideSuffix
            ? sideSuffix.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
            : null;

        characters[avatarId] = {
            _derivedName: derivedName,
            NameTextMapHash: nameHashStr ? Number(nameHashStr) : null,
            Element: element,
            SideIconName: normPath(sideIcon),
            QualityType: quality,
            WeaponType: weaponType,
            SkillOrder: skillOrder,
            Skills: skills,
            Consts: consts,
        };
    }

    // Weapons: 5-digit IDs with numeric WeaponType
    const wRe = /\b(1[0-9]{4})\s*:\s*\{/g;
    while ((m = wRe.exec(content)) !== null) {
        const itemId = m[1];
        const objStr = extractJsObject(content, m.index + m[0].length - 1);
        if (!objStr) continue;
        const weaponType = (objStr.match(/"?WeaponType"?\s*:\s*(\d+)/) || [])[1];
        if (!weaponType) continue;
        const icon       = (objStr.match(/"?Icon"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const awakenIcon = (objStr.match(/"?AwakenIcon"?\s*:\s*"([^"]+)"/) || [])[1] ?? null;
        const nameHashStr = (objStr.match(/"?NameTextMapHash"?\s*:\s*(\d+)/) || [])[1] ?? null;
        const rarity      = (objStr.match(/"?Rarity"?\s*:\s*(\d+)/) || [])[1] ?? null;
        weapons[itemId] = {
            Icon: normPath(icon),
            AwakenIcon: normPath(awakenIcon),
            NameTextMapHash: nameHashStr ? Number(nameHashStr) : null,
            RankLevel: rarity ? Number(rarity) : null,
            WeaponType: Number(weaponType),
        };
    }

    /**
     * Profile pictures (pfps): `<id>: { IconPath: "/ui/UI_AvatarIcon_..._Circle.png" }`
     * We only extract the IconPath since the ID is opaque and the name can be derived from the icon path itself. The Circle suffix is stripped since Enka's pfps.json doesn't have it, and it doesn't add info for our purposes. The resulting bare icon name (e.g. "UI_AvatarIcon_Linnea") can be cross-referenced with the loc.json to get a display name if needed.
     */
    const pfps: Record<string, string> = {};
    const pfpRe = /\b(\d{3,7})\s*:\s*\{\s*IconPath\s*:\s*"([^"]+)"\s*\}/g;
    while ((m = pfpRe.exec(content)) !== null) {
        const id = m[1];
        // Strip "/ui/" + ".png" + "_Circle" → bare icon name (matches pfps.json convention)
        const bare = (normPath(m[2]) ?? m[2]).replace(/_Circle$/, "");
        if (bare) pfps[id] = bare;
    }

    return { characters, weapons, pfps };
}

/** Fetch & parse the live LodaHoyoView bundle from enka.network. */
async function fetchLiveSupplementData(): Promise<GiSupplement | null> {
    try {
        const homeRes: AxiosResponse<string> = await axios.get(`${ENKA_BASE_URL}/`, {
            headers: { "User-Agent": USER_AGENT },
            timeout: REQUEST_TIMEOUT,
            responseType: "text",
        });
        const appEntryMatch = (homeRes.data as string).match(
            /import\("(\.?\/_app\/immutable\/entry\/app\.[^"]+\.js)"\)/
        );
        if (!appEntryMatch) return null;
        const appEntryUrl = `${ENKA_BASE_URL}/${appEntryMatch[1].replace(/^\.?\//, "")}`;

        const appRes: AxiosResponse<string> = await axios.get(appEntryUrl, {
            headers: { "User-Agent": USER_AGENT },
            timeout: REQUEST_TIMEOUT,
            responseType: "text",
        });
        const chunkMatch = (appRes.data as string).match(
            /(LodaHoyoView\.svelte_svelte_type_style_lang\.[a-f0-9]+\.js)/
        );
        if (!chunkMatch) return null;
        const bundleUrl = `${ENKA_BASE_URL}/_app/immutable/chunks/${chunkMatch[1]}`;

        const bundleRes: AxiosResponse<string> = await axios.get(bundleUrl, {
            headers: { "User-Agent": USER_AGENT },
            timeout: 30_000,
            responseType: "text",
        });

        return parseBundleData(bundleRes.data as string);
    } catch {
        return null;
    }
}

/** Return supplement data (live-fetch → local-file fallback → null). */
// On-disk cache so we don't have to refetch the 3.4 MB bundle each time the
// process restarts — it just needs to refresh in the background after TTL.
const SUPPLEMENT_DISK_PATH = resolve(process.cwd(), "temp/gi-store-supplement.json");

function readSupplementFromDisk(): GiSupplement | null {
    if (!existsSync(SUPPLEMENT_DISK_PATH)) return null;
    try {
        const json = JSON.parse(readFileSync(SUPPLEMENT_DISK_PATH, "utf-8"));
        if (json && !json.pfps) json.pfps = {};
        return json as GiSupplement;
    } catch {
        return null;
    }
}

function writeSupplementToDisk(data: GiSupplement): void {
    try {
        mkdirSync(dirname(SUPPLEMENT_DISK_PATH), { recursive: true });
        writeFileSync(
            SUPPLEMENT_DISK_PATH,
            JSON.stringify({ ...data, _writtenAt: new Date().toISOString() }, null, 2),
            "utf-8"
        );
    } catch { /* swallow — disk cache is best-effort */ }
}

function diskFileAgeMs(): number {
    try { return Date.now() - statSync(SUPPLEMENT_DISK_PATH).mtimeMs; }
    catch { return Number.POSITIVE_INFINITY; }
}

let inflightRefresh: Promise<GiSupplement | null> | null = null;
async function refreshSupplementInBackground(): Promise<GiSupplement | null> {
    if (inflightRefresh) return inflightRefresh;          // de-dup concurrent triggers
    inflightRefresh = (async () => {
        try {
            const fresh = await fetchLiveSupplementData();
            if (fresh) {
                if (!fresh.pfps) fresh.pfps = {};
                supplementCache = { value: fresh, expiresAt: Date.now() + STORE_CACHE_TTL };
                writeSupplementToDisk(fresh);
            }
            return fresh;
        } finally {
            inflightRefresh = null;
        }
    })();
    return inflightRefresh;
}

/**
 * Returns supplement data with stale-while-revalidate semantics:
 *   1. Memory cache (instant) → if not expired, return immediately.
 *   2. Disk cache (instant)   → if present, return immediately and refresh
 *      live data in the background. Caller never waits for the bundle download.
 *   3. Live fetch (slow)      → only when nothing is cached at all.
 */
async function getSupplementData(): Promise<GiSupplement | null> {
    // 1. Memory hit
    if (supplementCache && Date.now() < supplementCache.expiresAt) {
        return supplementCache.value;
    }

    // 2. Disk hit → serve immediately, refresh in background
    const disk = readSupplementFromDisk();
    if (disk) {
        // Prime the in-memory cache with disk data
        supplementCache = { value: disk, expiresAt: Date.now() + STORE_CACHE_TTL };
        // Trigger background refresh if memory was expired or disk file is older than TTL
        if (diskFileAgeMs() > STORE_CACHE_TTL) {
            void refreshSupplementInBackground();
        }
        return disk;
    }

    // 3. No cache at all — must fetch live (slow path, only on very first run)
    const fresh = await refreshSupplementInBackground();
    if (fresh) return fresh;

    // Last resort: empty supplement so callers don't crash
    return null;
}

/**
 * Pre-warm the supplement cache. Call once at bot startup so the
 * 3.4 MB bundle download happens BEFORE any user issues an Enka command,
 * and so the in-memory cache is hot for the whole TTL window.
 *
 * - If a recent disk cache exists, it's loaded synchronously into memory
 *   (instant) and a background refresh is kicked off.
 * - Otherwise the live fetch runs to completion so first request is fast.
 */
export async function warmupGiSupplement(): Promise<void> {
    // Hydrate from disk first (cheap, blocking; returns instantly if absent)
    const disk = readSupplementFromDisk();
    if (disk) {
        supplementCache = { value: disk, expiresAt: Date.now() + STORE_CACHE_TTL };
    }

    // Decide whether to fetch live now or in the background:
    //   - No disk cache         → block until we have something usable.
    //   - Disk cache too old    → background refresh, don't block startup.
    //   - Disk cache fresh      → nothing to do.
    if (!disk) {
        try { await refreshSupplementInBackground(); } catch { /* ignored */ }
        return;
    }
    if (diskFileAgeMs() > STORE_CACHE_TTL) {
        void refreshSupplementInBackground();
    }
}

/** Derive a display name from a weapon icon path like "UI_EquipIcon_Catalyst_Brisingamen_Awaken" */
function weaponNameFromIcon(icon: string | null | undefined): string | null {
    if (!icon) return null;
    const bare = icon
        .replace(/UI_EquipIcon_/, "")
        .replace(/_Awaken$/, "");
    // bare is like "Catalyst_Brisingamen" — strip the weapon-type prefix (first word)
    const parts = bare.split("_");
    const meaningful = parts.length > 1 ? parts.slice(1) : parts;
    return meaningful.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ") || null;
}

/** Derive artifact set ID from icon path like "UI_RelicIcon_15043_1" → "Set 15043" */
function setNameFromIcon(icon: string | null | undefined): string {
    if (!icon) return "Unknown Set";
    const m = icon.match(/UI_RelicIcon_(\d+)_/);
    return m ? `Set ${m[1]}` : "Unknown Set";
}

let pfpsCache: TTLCache<any> | null = null;
async function getPfpsData() {
    if (pfpsCache && Date.now() < pfpsCache.expiresAt) return pfpsCache.value;
    const data = await getStoreData("pfps.json");
    pfpsCache = { value: data, expiresAt: Date.now() + STORE_CACHE_TTL };
    return pfpsCache.value;
}

export type { GenshinCharacterInfo, GenshinWeaponInfo, EnkaCharacter, EnkaUserData };

export async function fetchAllCharacters(): Promise<GenshinCharacterInfo[]> {
    const [characters, loc] = await Promise.all([getCharactersData(), getLocData()]);
    const result: GenshinCharacterInfo[] = [];

    for (const [id, char] of Object.entries(characters) as [string, any][]) {
        const name = loc[char.NameTextMapHash];
        if (!name || name === "Traveler") continue; // skip traveler duplicates
        const rarity = char.QualityType === "QUALITY_ORANGE" || char.QualityType === "QUALITY_ORANGE_SP" ? 5 : 4;
        result.push({
            id,
            name,
            element: elementMap[char.Element] || char.Element || "Unknown",
            weaponType: weaponTypeMap[char.WeaponType] || char.WeaponType || "Unknown",
            rarity,
        });
    }

    // Deduplicate by name and sort
    const seen = new Set<string>();
    return result.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; })
        .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}

export async function fetchAllWeapons(): Promise<GenshinWeaponInfo[]> {
    const { data } = await axios.get<any[]>("https://genshin.jmp.blue/weapons/all?lang=en", {
        headers: { "User-Agent": USER_AGENT }, timeout: REQUEST_TIMEOUT,
    });

    return data
        .map((w) => ({ id: w.id, name: w.name, type: w.type, rarity: w.rarity }))
        .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name));
}

const fightProps: Record<string, string> = {
    "2000": "Max HP",
    "2001": "ATK",
    "2002": "DEF",
    "28": "Elemental Mastery",
    "20": "CRIT Rate",
    "22": "CRIT DMG",
    "23": "Energy Recharge",
    "26": "Healing Bonus",
    "30": "Physical DMG%",
    "40": "Pyro DMG%",
    "41": "Electro DMG%",
    "42": "Hydro DMG%",
    "43": "Dendro DMG%",
    "44": "Anemo DMG%",
    "45": "Geo DMG%",
    "46": "Cryo DMG%",
};

const percentProps = new Set([
    "20", "22", "23", "26", "30",
    "40", "41", "42", "43", "44", "45", "46",
]);

// Artifact stat prop name → [displayName, isPercent]
// Raw API values: flat stats are plain numbers; percent stats are decimals (0.066 = 6.6%)
const artifactPropMap: Record<string, [string, boolean]> = {
    FIGHT_PROP_HP:                  ["HP",              false],
    FIGHT_PROP_ATTACK:              ["ATK",             false],
    FIGHT_PROP_DEFENSE:             ["DEF",             false],
    FIGHT_PROP_HP_PERCENT:          ["HP%",             true],
    FIGHT_PROP_ATTACK_PERCENT:      ["ATK%",            true],
    FIGHT_PROP_DEFENSE_PERCENT:     ["DEF%",            true],
    FIGHT_PROP_CRITICAL:            ["CRIT Rate",       true],
    FIGHT_PROP_CRITICAL_HURT:       ["CRIT DMG",        true],
    FIGHT_PROP_CHARGE_EFFICIENCY:   ["Energy Recharge", true],
    FIGHT_PROP_ELEMENT_MASTERY:     ["Elem. Mastery",   false],
    FIGHT_PROP_HEAL_ADD:            ["Healing Bonus",   true],
    FIGHT_PROP_FIRE_ADD_HURT:       ["Pyro DMG%",       true],
    FIGHT_PROP_WATER_ADD_HURT:      ["Hydro DMG%",      true],
    FIGHT_PROP_GRASS_ADD_HURT:      ["Dendro DMG%",     true],
    FIGHT_PROP_ELEC_ADD_HURT:       ["Electro DMG%",    true],
    FIGHT_PROP_WIND_ADD_HURT:       ["Anemo DMG%",      true],
    FIGHT_PROP_ROCK_ADD_HURT:       ["Geo DMG%",        true],
    FIGHT_PROP_ICE_ADD_HURT:        ["Cryo DMG%",       true],
    FIGHT_PROP_PHYSICAL_ADD_HURT:   ["Physical DMG%",   true],
    FIGHT_PROP_SHIELD_COST_MINUS_RATIO: ["Shield Str%", true],
};

// Artifact slot → [displayName, sortOrder]
const artifactSlotMap: Record<string, [string, number]> = {
    EQUIP_BRACER:   ["Flower",   0],
    EQUIP_NECKLACE: ["Plume",    1],
    EQUIP_SHOES:    ["Sands",    2],
    EQUIP_RING:     ["Goblet",   3],
    EQUIP_DRESS:    ["Circlet",  4],
};

const genshinElementColors: Record<string, string> = {
    Pyro: "#ff4d4d", Cryo: "#80dfff", Hydro: "#4d94ff",
    Anemo: "#40ffbf", Electro: "#cc66ff", Geo: "#ffcc00",
    Dendro: "#66cc33",
};

export async function fetchEnkaUser(uid: string | number): Promise<EnkaUserData> {
    if (isNaN(Number(uid))) throw new Error("UID harus berupa angka.");

    // Fetch player data, store data, and supplement in parallel
    const [apiResult, storeResult, supplementResult] = await Promise.all([
        axios.get(`${ENKA_BASE_URL}/api/uid/${uid}`, {
            headers: { "User-Agent": USER_AGENT },
            timeout: REQUEST_TIMEOUT,
        }).catch((e) => { if (e.response) return e.response; throw e; }),
        Promise.all([getCharactersData(), getLocData()]).catch(() => [null, null] as [null, null]),
        getSupplementData().catch(() => null),
    ]);

    const { data, status } = apiResult;
    if (status === 400) throw new Error("Format UID tidak valid.");
    if (status === 404) throw new Error("Player tidak ditemukan.");
    if (status === 424) throw new Error("Enka.Network sedang maintenance.");
    if (status === 429) throw new Error("Rate limit tercapai. Coba lagi nanti.");
    if (status !== 200) throw new Error(`Request gagal: ${status}`);

    const [charStore, loc] = storeResult as [any, Record<string, string>] | [null, null];
    const supplement = supplementResult as GiSupplement | null;
    const info = data.playerInfo || {};

    const characters: EnkaCharacter[] = (data.avatarInfoList || []).map((avatar: any) => {
        const propMap = avatar.propMap || {};
        const equipList: any[] = avatar.equipList || [];
        const fpm = avatar.fightPropMap || {};

        // Resolve character from GitHub store, then supplement as fallback
        const charId = String(avatar.avatarId);
        const skillDepotId = String(avatar.skillDepotId ?? "");
        const storeChar =
            charStore?.[charId] ??
            (skillDepotId ? charStore?.[`${charId}-${skillDepotId}`] : undefined) ??
            charStore?.[charId.split("-")[0]] ??
            supplement?.characters?.[charId];

        // Resolve name: try loc hash first, then _derivedName from supplement
        const nameHash = storeChar?.NameTextMapHash ? String(storeChar.NameTextMapHash) : null;
        const charName = (loc && nameHash ? (loc[nameHash] || null) : null) ?? storeChar?._derivedName ?? null;
        const element = elementMap[storeChar?.Element ?? ""] || storeChar?.Element || "Unknown";
        const elementColor = genshinElementColors[element] ?? "#888888";
        const weaponType = weaponTypeMap[storeChar?.WeaponType ?? ""] || storeChar?.WeaponType || "Unknown";
        const rarity = storeChar?.QualityType?.includes("ORANGE") ? 5 : 4;

        // Portrait: derive from SideIconName  → UI_Gacha_AvatarImg_{suffix}
        const sideIcon: string = storeChar?.SideIconName ?? "";
        const iconSuffix = sideIcon.replace("UI_AvatarIcon_Side_", "");
        const portrait = iconSuffix ? `UI_Gacha_AvatarImg_${iconSuffix}` : null;

        // Level + MaxLevel
        const level = propMap["4001"]?.val ? Number(propMap["4001"].val) : 0;
        const ascension = propMap["1002"]?.val ? Number(propMap["1002"].val) : 0;
        const maxLevel = [20, 40, 50, 60, 70, 80, 90][ascension] ?? 90;

        // Weapon
        const weaponEquip = equipList.find((e: any) => e.weapon);
        const wFlat = weaponEquip?.flat ?? {};
        const weaponNameFromLoc = loc && wFlat.nameTextMapHash ? (loc[String(wFlat.nameTextMapHash)] || null) : null;
        const weaponName = weaponNameFromLoc ?? weaponNameFromIcon(wFlat.icon as string);

        // Stats from fightPropMap
        const stats: { name: string; value: string }[] = [];
        for (const [id, name] of Object.entries(fightProps)) {
            const val = fpm[id];
            if (val && val > 0) {
                stats.push({
                    name,
                    value: percentProps.has(id) ? `${(val * 100).toFixed(1)}%` : Math.round(val).toLocaleString(),
                });
            }
        }

        // Artifacts
        const artifacts: EnkaArtifact[] = [];
        for (const equip of equipList) {
            if (!equip.reliquary) continue;
            const flat = equip.flat ?? {};
            const slotInfo = artifactSlotMap[flat.equipType as string];
            if (!slotInfo) continue;

            const setName = (loc && flat.setNameTextMapHash
                ? loc[String(flat.setNameTextMapHash)] || null
                : null) ?? setNameFromIcon(flat.icon as string);

            const mainId: string = flat.reliquaryMainstat?.mainPropId ?? "";
            const mainPropInfo = artifactPropMap[mainId];
            const mainVal: number = flat.reliquaryMainstat?.statValue ?? 0;
            const mainStat: EnkaArtifactStat = {
                name: mainPropInfo?.[0] ?? mainId ?? "Unknown",
                value: mainPropInfo?.[1]
                    ? `${mainVal.toFixed(1)}%`
                    : Math.round(mainVal).toLocaleString(),
            };

            const subStats: EnkaArtifactStat[] = (flat.reliquarySubstats ?? []).map((sub: any) => {
                const info = artifactPropMap[sub.appendPropId as string];
                const val: number = sub.statValue ?? 0;
                return {
                    name: info?.[0] ?? sub.appendPropId ?? "Unknown",
                    value: info?.[1]
                        ? `${val.toFixed(1)}%`
                        : Math.round(val).toLocaleString(),
                };
            });

            artifacts.push({
                slot: slotInfo[0],
                setName,
                rarity: flat.rankLevel ?? 5,
                level: (equip.reliquary?.level ?? 1) - 1,
                icon: (flat.icon as string) ?? null,
                mainStat,
                subStats,
            });
        }
        artifacts.sort((a, b) => {
            const order = ["Flower", "Plume", "Sands", "Goblet", "Circlet"];
            return order.indexOf(a.slot) - order.indexOf(b.slot);
        });

        // Skills (Normal / Skill / Burst = 3 smallest talent IDs)
        const skillLevelMap: Record<string, number> = avatar.skillLevelMap ?? {};
        const skillOrder: number[] = storeChar?.SkillOrder ?? [];
        const skillIcons: Record<string, string> = storeChar?.Skills ?? {};
        const sortedIds = skillOrder.length >= 3
            ? skillOrder.slice(0, 3)
            : Object.keys(skillLevelMap).map(Number).sort((a, b) => a - b).slice(0, 3);
        const skillLabels = ["Normal", "Skill", "Burst"];
        const skills = sortedIds.map((id, i) => ({
            name: skillLabels[i] ?? `Skill ${i + 1}`,
            level: skillLevelMap[String(id)] ?? 1,
            icon: skillIcons[String(id)] ?? null,
        }));

        return {
            name: charName,
            element,
            elementColor,
            weaponType,
            rarity,
            portrait,
            level,
            maxLevel,
            constellation: (avatar.talentIdList ?? []).length,
            constellationIcons: (storeChar?.Consts ?? []).map((c: string) => `${ENKA_BASE_URL}/ui/${c}.png`),
            friendship: avatar.fetterInfo?.expLevel ?? 0,
            weapon: weaponEquip ? {
                name: weaponName,
                level: weaponEquip.weapon?.level ?? 0,
                refinement: weaponEquip.weapon?.affixMap
                    ? (Object.values(weaponEquip.weapon.affixMap)[0] as number) + 1
                    : 1,
                stars: wFlat.rankLevel ?? 0,
                icon: (wFlat.icon as string) ?? null,
            } : null,
            stats,
            artifacts,
            skills,
        };
    });

    // Profile picture
    const pfpId = data.playerInfo?.profilePicture?.id;
    let profileIcon: string | null = null;
    if (pfpId) {
        try {
            const pfps = await getPfpsData();
            const pfp = pfps[String(pfpId)];
            if (pfp?.iconPath) {
                const iconName = pfp.iconPath.includes("_7")
                    ? pfp.iconPath
                    : pfp.iconPath.replace("_Circle", "");
                profileIcon = `${ENKA_BASE_URL}/ui/${iconName}.png`;
            }
        } catch {}

        if (!profileIcon) {
            try {
                const sup = await getSupplementData();
                const supIcon = sup?.pfps?.[String(pfpId)];
                if (supIcon) {
                    profileIcon = `${ENKA_BASE_URL}/ui/${supIcon}.png`;
                }
            } catch {}
        }
    }
    // Fallback 2: use first showcase character's avatar icon
    if (!profileIcon) {
        const showList = info.showAvatarInfoList ?? [];
        const firstAvatar = showList[0]?.avatarId ?? (data.avatarInfoList?.[0]?.avatarId);
        if (firstAvatar && charStore) {
            const c = charStore[String(firstAvatar)];
            if (c?.SideIconName) {
                const parts = c.SideIconName.split("_");
                profileIcon = `${ENKA_BASE_URL}/ui/UI_AvatarIcon_${parts[parts.length - 1]}.png`;
            }
        }
    }

    return {
        uid: Number(uid),
        nickname: info.nickname || "Unknown",
        signature: info.signature || null,
        level: info.level || 0,
        worldLevel: info.worldLevel || 0,
        achievements: info.finishAchievementNum || 0,
        spiralAbyss: info.towerFloorIndex
            ? { floor: info.towerFloorIndex, chamber: info.towerLevelIndex }
            : null,
        profileIcon,
        characters,
        url: `${ENKA_BASE_URL}/u/${uid}/`,
    };
}
