declare type Config = {
    ownerNumber: string[];
    teamNumber: string[];
    timezone: string;
    prefix: string;
    version: [number, number, number];
    maintenance: string[];
    stickers: Stickers;
    settings: Settings;
    limit: Limit;
    call: {
        status: "block" | "reject" | "off";
    };
    cfonts: CfontsConfig;
};

declare type Stickers = {
    author: string;
    packname: string;
};

declare type Settings = {
    ownerNotifyOnline: boolean;
    useLimit: boolean;
    useCooldown: boolean;
    selfbot: boolean;
    autoReadMessage: boolean;
    autoReadStatus: boolean;
};

declare type Limit = {
    command: number;
};

declare type CfontsConfig = {
    font?: string;
    align?: string;
    colors?: string[];
    background?: string;
    letterSpacing?: number;
    lineHeight?: number;
    space?: boolean;
    maxLength?: string;
    gradient?: boolean;
    independentGradient?: boolean;
    transitionGradient?: boolean;
    env?: string;
};
