export interface GenshinCharacterInfo {
    id: string;
    name: string;
    element: string;
    weaponType: string;
    rarity: number;
}

export interface GenshinWeaponInfo {
    id: string;
    name: string;
    type: string;
    rarity: number;
}

export interface EnkaArtifactStat {
    name: string;
    value: string;
}

export interface EnkaArtifact {
    slot: string;       // "Flower" | "Plume" | "Sands" | "Goblet" | "Circlet"
    setName: string;
    rarity: number;
    level: number;
    icon: string | null;    // e.g. "UI_RelicIcon_15025_4"
    mainStat: EnkaArtifactStat;
    subStats: EnkaArtifactStat[];
}

export interface EnkaCharacter {
    name: string | null;
    element: string;
    elementColor: string;
    weaponType: string;
    rarity: number;
    portrait: string | null;    // icon name e.g. "UI_Gacha_AvatarImg_Qin"
    level: number;
    maxLevel: number;
    constellation: number;
    constellationIcons: string[];
    friendship: number;
    weapon: { name: string | null; level: number; refinement: number; stars: number; icon: string | null } | null;
    stats: { name: string; value: string }[];
    artifacts: EnkaArtifact[];
    skills: { name: string; level: number; icon: string | null }[];
}

export interface EnkaUserData {
    uid: number;
    nickname: string;
    signature: string | null;
    level: number;
    worldLevel: number;
    achievements: number;
    spiralAbyss: { floor: number; chamber: number } | null;
    profileIcon: string | null;
    characters: EnkaCharacter[];
    url: string;
}
