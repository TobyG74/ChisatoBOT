import {
    AnyMessageContent,
    WAMediaUpload,
    WAProto,
    downloadContentFromMessage,
    jidDecode,
    proto,
    toBuffer,
} from "baileys";
import { fromBuffer } from "file-type";
import clc from "cli-color";
import fs from "fs";
import moment from "moment-timezone";

/** Types */
import { FullJid } from "baileys";
import { Chisato } from "../../types/client";
import { StickerTypes } from "wa-sticker-formatter";
import { Readable } from "form-data";
import { MessageSerialize } from "../../types/serialize";

/** Function */
import Sticker from "wa-sticker-formatter";
import PhoneNumber from "awesome-phonenumber";
import { generateRandomNumber, isURL } from "../../utils/function";

export const sendmessage = async (Chisato: Chisato, store: any) => {
    const time = moment().format("HH:mm:ss DD/MM");
    const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

    Chisato.config = config;

    /** Simply Log */
    Chisato.log = (type: "status" | "info" | "error" | "eval" | "exec" | "connect", text: string, text2?: string) => {
        switch (type.toLowerCase()) {
            case "status":
                return console.log(clc.green.bold("["), clc.yellow.bold(text), clc.green.bold("]"), clc.blue(text2));
            case "info":
                return console.log(clc.green.bold("["), clc.yellow.bold("INFO"), clc.green.bold("]"), clc.blue(text));
            case "error":
                return console.log(
                    clc.green.bold("["),
                    clc.red.bold("ERROR"),
                    clc.green.bold("]"),
                    clc.blue(time),
                    "|",
                    clc.cyan(text),
                    "|",
                    clc.red(text2)
                );
            case "eval":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EVAL"),
                    clc.green.bold("]"),
                    clc.blue(time),
                    clc.green(text)
                );
            case "exec":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EXEC"),
                    clc.green.bold("]"),
                    clc.blue(time),
                    clc.green(text)
                );
            case "connect":
                return console.log(clc.green.bold("[ ! ]"), clc.blue(text));
        }
    };

    /** Download Media from Message
     * @param message
     * @returns {Promise<Buffer>}
     */

    Chisato.downloadMediaMessage = async (m: MessageSerialize): Promise<Buffer> => {
        const mime = m.message[m.type].mimetype || "";
        const messageType = mime.split("/")[0];
        const stream = await downloadContentFromMessage(m.message[m.type], messageType);
        return await toBuffer(stream);
    };

    /**
     * Download And Save Media from Message
     * @param message
     * @param filename
     * @param attachExtension
     * @returns
     */

    Chisato.downloadAndSaveMediaMessage = async (
        m: MessageSerialize,
        folder: string,
        attachExtension = true
    ): Promise<string> => {
        const mime = m.message[m.type].mimetype || "";
        const messageType = mime.split("/")[0];
        const pathfile = folder + `/${m.sender.split("@")[0]}_${Date.now()}`;
        const stream = await downloadContentFromMessage(m.message[m.type], messageType);
        let buffer = await toBuffer(stream);
        const type = await fromBuffer(buffer);
        const filePath = attachExtension ? pathfile + "." + type.ext : pathfile;
        fs.writeFileSync(filePath, buffer);
        buffer = null;
        return filePath;
    };

    /**
     * Using the Sticker conversion module from Alensantio1
     * https://github.com/Alensaito1/wa-sticker-formatter
     */

    Chisato.sendMediaAsSticker = async (
        jid: string,
        options: { pack: string; author: string },
        buffer: Buffer,
        type: StickerTypes,
        quoted?: MessageSerialize
    ) => {
        const sticker = new Sticker(buffer, {
            pack: options.pack,
            author: options.author,
            type:
                type === "full"
                    ? "full"
                    : type === "default"
                    ? "default"
                    : type === "circle"
                    ? "circle"
                    : type === "rounded"
                    ? "rounded"
                    : "crop",
            categories: [
                "😀",
                "😃",
                "😄",
                "😁",
                "😆",
                "😅",
                "😂",
                "🤣",
                "🙂",
                "😛",
                "😝",
                "😜",
                "🤪",
                "🤗",
                "😺",
                "😸",
                "😹",
                "😌",
                "😉",
                "🤗",
                "😊",
            ],
            id: generateRandomNumber(5),
            quality: 15,
        });
        return Chisato.sendMessage(jid, await sticker.toMessage(), {
            quoted,
        });
    };

    /**
     * Decode Jid
     * @param jid
     * @returns
     */

    Chisato.decodeJid = (jid: string) => {
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || ({} as FullJid);
            return ((decode.user && decode.server && decode.user + "@" + decode.server) || jid).trim();
        } else return jid.trim();
    };

    /**
     * Send Text Message (with options)
     * @param jid group or user jid)
     * @param text message text
     * @param m WAMessage
     * @param options MiscMessageGenerationOptions
     */

    Chisato.sendText = async (
        jid: string,
        text: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        return Chisato.sendMessage(jid, { text: text, ...options }, { quoted });
    };

    /**
     * Sending Image Messages
     * @param {string} jid (group or private) number of the report
     * @param {Buffer|string|Readable} image sending with buffer or url
     * @param {string} text caption for image
     * @param {object} options
     * @param {object} quoted
     * @returns
     */

    Chisato.sendImage = async (
        jid: string,
        image: WAMediaUpload,
        text?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        let media: WAMediaUpload;
        if (typeof image === "string" && isURL(image)) {
            media = { url: image };
        } else if (Buffer.isBuffer(image)) {
            media = image;
        } else {
            media = { stream: image as unknown as Readable };
        }
        return Chisato.sendMessage(jid, { image: media, caption: text, ...options }, { quoted });
    };

    /**
     * Sending Video Messages
     * @param {string} jid (group or private) number of the report
     * @param {Buffer|string|Readable} video sending video with buffer or url
     * @param {boolean} gifPlayback gif playback
     * @param {string} text caption for video
     * @param {object} options
     * @param {object} quoted
     * @returnscd
     */

    Chisato.sendVideo = async (
        jid: string,
        video: WAMediaUpload,
        gifPlayback?: boolean,
        text?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        let media: WAMediaUpload;
        if (typeof video === "string" && isURL(video)) {
            media = { url: video };
        } else if (Buffer.isBuffer(video)) {
            media = video;
        } else {
            media = { stream: video as unknown as Readable };
        }
        return Chisato.sendMessage(
            jid,
            { video: media, caption: text, gifPlayback: gifPlayback ? true : false, ...options },
            { quoted }
        );
    };

    /**
     * Sending Audio Messages
     * @param {string} jid (group or private) number of the report
     * @param {buffer|url} audio sending image with buffer or url
     * @param {boolean} ptt sending audio without ptt
     * @param {object} options
     * @param {object} quoted
     * @returns
     */

    Chisato.sendAudio = async (
        jid: string,
        audio: WAMediaUpload,
        ptt: boolean,
        mimetype: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        let media: WAMediaUpload;
        if (typeof audio === "string" && isURL(audio)) {
            media = { url: audio };
        } else if (Buffer.isBuffer(audio)) {
            media = audio;
        } else {
            media = { stream: audio as unknown as Readable };
        }
        return Chisato.sendMessage(
            jid,
            { audio: media, ptt: ptt, mimetype: !mimetype ? "audio/mp4" : mimetype, ...options },
            { quoted }
        );
    };

    /**
     * Send Reaction Message
     * @param jid (group or private)
     * @param emoji
     * @param m
     */

    Chisato.sendReaction = async (
        jid: string,
        emoji: string,
        m: proto.IMessageKey
    ): Promise<WAProto.WebMessageInfo> => {
        return Chisato.sendMessage(jid, {
            react: { text: emoji, key: m },
        });
    };

    /**
     * Get user name from jid if saved in store
     * @param {string} jid (group or private) number of the report
     * @param {boolean} withoutContact
     * @returns
     */

    Chisato.getName = (jid: string) => {
        var id = jid.endsWith("@s.whatsapp.net") ? Chisato.decodeJid(jid) : Chisato.decodeJid(jid) + "@s.whatsapp.net";
        let v;
        if (id.endsWith("@g.us"))
            return new Promise(async (resolve) => {
                v = store.contacts[id];
                if (!(v.name || v.subject)) v = Chisato.groupMetadata(id).catch(() => {}) || {};
                resolve(
                    v.name ||
                        v.subject ||
                        PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international")
                );
            });
        else
            v =
                id === "0@s.whatsapp.net"
                    ? { id, name: "WhatsApp" }
                    : store.messages[id]
                    ? store.messages[id].array[0]
                    : id === Chisato.decodeJid(Chisato.user.id)
                    ? Chisato.user
                    : store.contacts
                    ? store.contacts[id]
                    : {};
        return (
            v?.subject ||
            v?.verifiedName ||
            v?.pushName ||
            PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international")
        );
    };

    /**
     * Sending a Contact Message with Custom Array
     * @param {string} jid (group or private) number of the report
     * @param {object} contacts
     * @param {object} quoted
     * @param {string} opts
     */

    Chisato.sendContact = async (
        jid: string,
        contacts: string[],
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        const listContact = [];
        for (let i of contacts) {
            const number = i.split("@")[0];
            const pushname = Chisato.getName(i);
            const awesomeNumber = PhoneNumber("+" + number).getNumber("international");
            listContact.push({
                displayName: pushname,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${pushname}\nFN:${pushname}\nitem1.TEL;waid=${number}:${awesomeNumber}\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
            });
        }
        return Chisato.sendMessage(
            jid,
            {
                contacts: {
                    displayName: `${listContact.length} Kontak`,
                    contacts: listContact,
                },
                ...options,
            },
            { quoted }
        );
    };
};
