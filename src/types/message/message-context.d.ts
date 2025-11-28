declare type MessageContext = {
    // Message data
    body: string;
    from: string;
    sender: string;
    pushName: string;
    type: string;
    args: string[];
    arg: string;
    query: string;
    isGroup: boolean;
    fromMe: boolean;

    // Bot data
    botNumber: string;
    botName: string;
    prefix: string;

    // Permissions
    isOwner: boolean;
    isTeam: boolean;
    isGroupAdmin: boolean;
    isGroupOwner: boolean;
    isBotAdmin: boolean;
    isBlock: boolean;
    isBanned: boolean;
    isMute: boolean;
    isLimit: boolean;
    isPremium: boolean;

    // Group data
    groupName?: string;
    groupDescription?: string;
    groupParticipants?: Array<{
        id?: string;
        admin?: string | null;
        lid?: string;
        phoneNumber?: string;
    }>;
    groupAdmins?: Array<{
        id?: string;
        admin?: string | null;
        lid?: string;
        phoneNumber?: string;
    }>;
    groupMetadata?: {
        groupId: string;
        subject: string;
        desc?: string;
        participants: Array<{
            id?: string;
            admin?: string | null;
            lid?: string;
            phoneNumber?: string;
        }>;
        settings: {
            notify: boolean;
            welcome: boolean;
            leave: boolean;
            mute: boolean;
            antilink: {
                status?: boolean;
                mode: "kick" | "delete";
                list: string[];
            };
            antibot: boolean;
            banned: string[];
        };
    };
    groupSettingData?: {
        notify: boolean;
        welcome: boolean;
        leave: boolean;
        mute: boolean;
        antilink: {
            status?: boolean;
            mode: "kick" | "delete";
            list: string[];
        };
        antibot: boolean;
        banned: string[];
    };

    // User data
    userMetadata: {
        userId: string;
        name?: string;
        limit: number;
        role: "free" | "premium";
        expired: number;
        isBanned: boolean;
        afk: {
            status: boolean;
            reason?: string;
            since?: number;
        };
    };
    blockList: string[];

    // Command
    isCmd: boolean;
    cmd?: string;
    command?: any;
};
