export interface ZZZStat {
    name: string;
    value: string;
}

export interface ZZZDiscStat {
    name: string;
    value: string;
}

export interface ZZZDisc {
    slot: number;       // 1-6
    setName: string;
    rarity: number;
    level: number;
    mainStat: ZZZDiscStat;
    subStats: ZZZDiscStat[];
}

export interface ZZZAgent {
    id: number;
    name: string;
    level: number;
    promotion: number;
    mindscape: number;
    coreSkill: number;
    rarity: number;
    element: string[];
    specialty: string;
    portrait: string | null;    // filename e.g. "IconRolePic_Nicole"
    weapon: { id: number; name: string | null; level: number; stars: number; refine?: number } | null;
    stats: ZZZStat[];
    discs: ZZZDisc[];
    skillLevels: number[];      // [commonAttack, special, core, assist, chain]
}

export interface ZZZUserData {
    uid: number;
    nickname: string;
    description: string | null;
    level: number;
    profileIcon: string | null;
    agents: ZZZAgent[];
    url: string;
}
