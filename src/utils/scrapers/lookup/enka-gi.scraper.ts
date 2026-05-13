import axios from "axios";
import type { EnkaArtifact, EnkaArtifactStat, EnkaCharacter, EnkaUserData, GenshinCharacterInfo, GenshinWeaponInfo } from "../../../types/lookup/enka";

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

    // Fetch player data and store data in parallel
    const [apiResult, storeResult] = await Promise.all([
        axios.get(`${ENKA_BASE_URL}/api/uid/${uid}`, {
            headers: { "User-Agent": USER_AGENT },
            timeout: REQUEST_TIMEOUT,
        }).catch((e) => { if (e.response) return e.response; throw e; }),
        Promise.all([getCharactersData(), getLocData()]).catch(() => [null, null] as [null, null]),
    ]);

    const { data, status } = apiResult;
    if (status === 400) throw new Error("Format UID tidak valid.");
    if (status === 404) throw new Error("Player tidak ditemukan.");
    if (status === 424) throw new Error("Enka.Network sedang maintenance.");
    if (status === 429) throw new Error("Rate limit tercapai. Coba lagi nanti.");
    if (status !== 200) throw new Error(`Request gagal: ${status}`);

    const [charStore, loc] = storeResult as [any, Record<string, string>] | [null, null];
    const info = data.playerInfo || {};

    const characters: EnkaCharacter[] = (data.avatarInfoList || []).map((avatar: any) => {
        const propMap = avatar.propMap || {};
        const equipList: any[] = avatar.equipList || [];
        const fpm = avatar.fightPropMap || {};

        // Resolve character from store
        const charId = String(avatar.avatarId);
        const storeChar = charStore?.[charId] ?? charStore?.[charId.split("-")[0]];
        const charName = loc && storeChar ? (loc[String(storeChar.NameTextMapHash)] || null) : null;
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
        const weaponName = loc && wFlat.nameTextMapHash ? (loc[String(wFlat.nameTextMapHash)] || null) : null;

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

            const setName = loc && flat.setNameTextMapHash
                ? (loc[String(flat.setNameTextMapHash)] ?? "Unknown Set")
                : "Unknown Set";

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
    }
    // Fallback: use first showcase character's avatar icon
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
