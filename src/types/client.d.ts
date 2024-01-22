import { AnyMessageContent, WAProto, WASocket, proto } from "baileys";
import { Readable } from "form-data";
import { MessageSerialize } from "./serialize";

type Client = {
    downloadMediaMessage: (message: MessageSerialize) => Promise<Buffer>;
    downloadAndSaveMediaMessage: (
        message: MessageSerialize,
        folder: string,
        attachExtension?: boolean
    ) => Promise<string>;
    sendMediaAsSticker: (
        jid: string,
        options: { pack: string; author: string },
        buffer: Buffer,
        type: StickerTypes,
        quoted?: MessageSerialize
    ) => Promise<WAProto.WebMessageInfo>;
    decodeJid: (jid: string) => string;
    log: (type: "status" | "info" | "error" | "eval" | "exec" | "connect", text: string, text2?: string) => void;
    sendText: (
        jid: string,
        text: string,
        m?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ) => Promise<WAProto.WebMessageInfo>;
    sendImage: (
        jid: string,
        image: WAMediaUpload,
        text?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ) => Promise<WAProto.WebMessageInfo>;
    sendVideo: (
        jid: string,
        video: WAMediaUpload,
        gifPlayback?: boolean,
        text?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ) => Promise<WAProto.WebMessageInfo>;
    sendAudio: (
        jid: string,
        audio: WAMediaUpload,
        ptt: boolean,
        mimetype: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ) => Promise<WAProto.WebMessageInfo>;
    sendReaction: (jid: string, emoji: string, m?: proto.IMessageKey) => Promise<WAProto.WebMessageInfo>;
    sendContact: (
        jid: string,
        contacts: string[],
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ) => Promise<WAProto.WebMessageInfo>;
    getName: (jid, withoutContact = false) => Promise<string>;
    config: Config;
};

declare type Chisato = Partial<WASocket> & Client;
