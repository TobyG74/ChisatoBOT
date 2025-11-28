import type { proto } from "@whiskeysockets/baileys";

declare type MessageSerialize = {
    id: string;
    key: proto.IMessageKey & {
        remoteJidAlt?: string;
        participantAlt?: string;
        server_id?: string;
        addressingMode?: string;
        isViewOnce?: boolean;
    };
    from: string;
    fromMe: boolean;
    sender: string;
    pushName: string;
    type: string;
    message: proto.IMessage;
    expiration: number;
    messageTimestamp: long;
    mentions: string[];
    body: string;
    args: string[];
    arg: string;
    query: string;
    isGroup: boolean;
    groupMetadata: Group;
    download: () => Promise<Buffer>;
    quoted: MessageSerialize | null;
};

declare type GroupSerialize = {
    parameters: any;
    key: GroupUpdateMessageKey;
    from: string;
    timestamp: long;
    participant: string;
    type: WebMessageInfoStubType;
    message: proto.IMessage;
    expiration: number;
    pushName: string;
};

declare type GroupUpdateMessageKey = proto.IMessageKey & {
    id: string;
    fromMe: boolean;
    remoteJid: string;
    remoteJidAlt: string;
    participant: string;
    participantAlt: string;
    addressingMode: string;
    isViewOnce: boolean;
};
