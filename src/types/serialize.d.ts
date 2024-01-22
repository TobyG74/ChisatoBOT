import { proto } from "baileys";

declare type MessageSerialize = {
    id: string;
    key: proto.IMessageKey;
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
    parameters: string[];
    key: proto.IMessageKey;
    from: string;
    timestamp: long;
    participant: string;
    type: WebMessageInfoStubType;
    message: proto.IMessage;
    expiration: number;
};

declare type CallSerialize = {
    chatId: string;
    from: string;
    isGroup?: boolean;
    id: string;
    date: Date;
    isVideo?: boolean;
    status: "offer" | "ringing" | "timeout" | "reject" | "accept";
    offline: boolean;
    latencyMs?: number;
};
