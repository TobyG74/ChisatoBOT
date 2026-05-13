export interface HSRStatEntry {
    field: string;
    name: string;
    display: string;
    value: number;
    percent: boolean;
    icon: string;
}

export interface HSRRelicSubStat {
    name: string;
    display: string;
    percent: boolean;
    count: number;
}

export interface HSRRelic {
    id: string;
    name: string;
    setName: string;
    /** Last digit of id encodes slot: 1=Head 2=Hands 3=Body 4=Feet 5=Sphere 6=Rope */
    slotNum: number;
    rarity: number;
    level: number;
    icon: string;
    mainStat: { name: string; display: string; percent: boolean; field: string };
    subStats: HSRRelicSubStat[];
}

export interface HSRSkill {
    id: string;
    name: string;
    level: number;
    maxLevel: number;
    typeText: string;
    icon: string;
}

export interface HSRLightCone {
    id: string;
    name: string;
    level: number;
    superimposition: number;
    rarity: number;
    icon: string;
    hp: string | null;
    atk: string | null;
    def: string | null;
    bonus: string | null;
}

export interface HSRCharacter {
    avatarId: number;
    name: string;
    level: number;
    maxLevel: number;
    promotion: number;
    eidolons: number;
    eidolonIcons: string[];
    element: string;
    elementColor: string;
    path: string;
    rarity: number;
    portrait: string;
    lightCone: HSRLightCone | null;
    skills: HSRSkill[];
    relics: HSRRelic[];
    attributes: HSRStatEntry[];
    additions: HSRStatEntry[];
}

export interface HSRUserData {
    uid: number;
    nickname: string;
    signature: string | null;
    level: number;
    worldLevel: number;
    profileIcon: string | null;
    characters: HSRCharacter[];
    url: string;
}
