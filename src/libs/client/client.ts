console.clear();
import makeWASocket, {
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestWaWebVersion,
    proto,
    downloadContentFromMessage,
    toBuffer,
    jidDecode,
    AnyMessageContent,
    WAProto,
    WACallEvent,
    BaileysEventMap,
    WAMediaUpload,
    WASocket,
    Contact,
} from "baileys";
import { Boom } from "@hapi/boom";
import { Cron } from "croner";
import fs from "fs";
import clc from "cli-color";
import cfonts from "cfonts";
import EventEmitter from "events";
import moment from "moment";
import Pino from "pino";
import path from "path";
import Sticker from "wa-sticker-formatter";
import PhoneNumber from "awesome-phonenumber";

/** Config */
import { commands, settings } from "./commands";

/** Types */
import type { SocketConfig } from "../../types/auth/socket";
import type TypedEventEmitter from "typed-emitter";
import type { Chisato, ChisatoMediaUpload } from "../../types/auth/chisato";
import type { StickerTypes } from "wa-sticker-formatter";
import type { Readable } from "stream";
import type { MessageSerialize } from "../../types/structure/serialize";

/** Utils */
import { converter } from "../../utils";
import { Database, generateRandomNumber, isURL } from "..";
import { useMultiAuthState, useSingleAuthState } from "../../auth/auth";
import { fromBuffer } from "file-type";

/** Livs */
import { User as UserDatabase, Group as GroupDatabase } from "../database";

declare global {
    interface String {
        toLower(): string;
        toBold(): string;
        toUpper(): string;
        format(...args: any[]): string;
    }
}

String.prototype.toBold = function () {
    return this.split("")
        .map(function (v) {
            return converter.TextConvert("bold-sans", v);
        })
        .join("")
        .trim();
};

String.prototype.format = function (...args: any[]) {
    let a: string = this.toString(),
        b;
    for (b in args) {
        a = a.replace(/%[a-z]/, args[b]);
    }
    return a;
};

String.prototype.toLower = function () {
    return this.split(this.includes("-") ? "-" : " ")
        .map(function (v) {
            return v.charAt(0).toLowerCase() + v.slice(1);
        })
        .join(" ")
        .trim();
};

String.prototype.toUpper = function () {
    return this.split(this.includes("-") ? "-" : " ")
        .map(function (v) {
            return v.charAt(0).toUpperCase() + v.slice(1);
        })
        .join(" ")
        .trim();
};

String.prototype.toLower = function () {
    return this.split(this.includes("-") ? "-" : " ")
        .map(function (v) {
            return v.charAt(0).toLowerCase() + v.slice(1);
        })
        .join(" ")
        .trim();
};

String.prototype.toUpper = function () {
    return this.split(this.includes("-") ? "-" : " ")
        .map(function (v) {
            return v.charAt(0).toLowerCase() + v.slice(1);
        })
        .join(" ")
        .trim();
};

type Events = {
    "group.update": (creds: proto.IWebMessageInfo) => void;
    "messages.upsert": (messages: proto.IWebMessageInfo) => void;
    "contacts.update": (contact: Partial<Contact>) => void;
    call: (call: WACallEvent) => void;
};

let tryConnect = 0;
export class Client extends (EventEmitter as new () => TypedEventEmitter<Events>) {
    private config: Config;
    private package: any;
    private time: string;
    private socketConfig: SocketConfig;
    constructor(socketConfig: SocketConfig) {
        super();
        this.config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        this.package = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
        this.socketConfig = socketConfig;
        moment.tz.setDefault(this.config.timezone);
        this.time = moment().format("DD/MM HH:mm:ss");
        this.readcommands();
        this.readevents();
    }

    /** Connect to Whatsapp */
    async connect(): Promise<void> {
        if (!process.env.DATABASE_URL) {
            console.log(
                clc.redBright("[ ") +
                    clc.yellowBright("ERROR") +
                    clc.redBright(" ] ") +
                    clc.greenBright("Please set DATABASE_URL in .env file!")
            );
            return process.exit(0);
        }

        const { version, isLatest } = await fetchLatestWaWebVersion(null);
        const { state, saveCreds, clearState } =
            (this.socketConfig?.session === "single" && (await useSingleAuthState(Database))) ||
            (await useMultiAuthState(Database));

        /** Chisato as Client */
        const Chisato: Chisato = makeWASocket({
            ...this.socketConfig,
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "silent" }).child({ level: "silent" })),
            },
        });

        /** Connection Update */
        Chisato.ev.on("connection.update", async (connections) => {
            const { lastDisconnect, connection } = connections;
            if (connection === "connecting") {
                this.log("connect", `Successfully Registered ${commands.size} Commands!`);
                this.log("connect", `Successfully Registered ${settings.size} Group Settings!`);
            } else if (connection === "close") {
                let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                switch (reason) {
                    case DisconnectReason.restartRequired:
                        {
                            this.log("status", `${reason}`, "Restarting...");
                            this.connect();
                        }
                        break;
                    case DisconnectReason.connectionLost:
                        {
                            this.log("status", `${reason}`, "Connection Lost! Reconnecting...");
                            this.connect();
                        }
                        break;
                    case DisconnectReason.connectionClosed:
                        {
                            this.log("status", `${reason}`, "Connection Closed! Reconnecting...");
                            this.connect();
                        }
                        break;
                    case DisconnectReason.connectionReplaced:
                        {
                            this.log("status", `${reason}`, "Connection Replaced! Reconnecting...");
                            this.connect();
                        }
                        break;
                    case DisconnectReason.timedOut:
                        {
                            this.log("status", `${reason}`, "Timed Out! Reconnecting...");
                            this.connect();
                        }
                        break;
                    case DisconnectReason.loggedOut:
                        {
                            this.log("status", `${reason}`, "Session has been Logged Out! Please re-scan QR!");
                            await clearState();
                        }
                        break;
                    case DisconnectReason.forbidden:
                        if (tryConnect < 2) {
                            tryConnect++;
                            this.log("status", `${reason}`, "Forbidden! Try to reconnecting...");
                            this.connect();
                        } else {
                            this.log("status", `${reason}`, "Forbidden! Please re-scan QR!");
                            await clearState();
                        }
                        break;
                    case DisconnectReason.unavailableService:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log("status", `${reason}`, "Unavailable Service! Try to reconnecting...");
                                this.connect();
                            } else {
                                this.log("status", `${reason}`, "Unavailable Service! Please re-scan QR!");
                                await clearState();
                            }
                        }
                        break;
                    case DisconnectReason.multideviceMismatch:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log("status", `${reason}`, "Multidevice Mismatch! Try to reconnecting...");
                                this.connect();
                            } else {
                                this.log("status", `${reason}`, "Multidevice Mismatch! Please re-scan QR!");
                                await clearState();
                            }
                        }
                        break;
                    case DisconnectReason.badSession:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log("status", `${reason}`, "Bad Session! Try to reconnecting...");
                                this.connect();
                            } else {
                                this.log("status", `${reason}`, "Bad Session! Please re-scan QR!");
                                await clearState();
                            }
                        }
                        break;
                    default:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log("status", `${reason}`, "Another Reason! Try to reconnecting...");
                                this.connect();
                            } else {
                                this.log("status", `${reason}`, "Another Reason! Try to re-scan QR!");
                                await clearState();
                            }
                        }
                        break;
                }
            } else if (connection === "open") {
                tryConnect = 0;

                /** Logger */
                cfonts.say(this.user.name || "WhatsApp BOT", this.config.cfonts);
                this.log("connect", "Success Connected!");
                this.log("connect", "Creator : Tobz");
                this.log("connect", `Name    : ${this.user.name !== undefined ? this.user.name : this.package.name}`);
                this.log("connect", `Number  : ${this.user.id.split(":")[0]}`);
                this.log("connect", `Version : ${this.package.version}`);
                this.log("connect", `WA Web Version : ${version}`);
                this.log("connect", `Latest  : ${isLatest ? "YES" : "NO"}`);

                /** Reset Limit */
                this.reset();

                /** Sending Online Notification to Owner */
                if (this.config.settings.ownerNotifyOnline && this.config.ownerNumber.length !== 0) {
                    const str =
                        `「 *${this.user.name}* 」\n\n` +
                        `• Name    : ${this.user.name !== undefined ? this.user.name : this.package.name}` +
                        `• Number  : ${this.user.id.split(":")[0]}\n` +
                        `• Version : ${this.package.version}\n` +
                        `• WA Web Version : ${version}\n` +
                        `• Latest  : ${isLatest ? "YES" : "NO"}\n`;
                    this.log("connect", "Sending Online Notification to Owner...");
                    for (let owner of this.config.ownerNumber) {
                        await this.sendText(owner + "@s.whatsapp.net", str);
                    }
                    this.log("connect", "Success Sending Online Notification to Owner!");
                }
            }
        });

        /** Creds Update */
        Chisato.ev.on("creds.update", saveCreds);

        /** Message Event */
        Chisato.ev.on("messages.upsert", async ({ messages }) => {
            for (const message of messages) {
                if (message.message?.protocolMessage?.type === 3 || message?.messageStubType) {
                    this.emit("group.update", message);
                } else {
                    this.emit("messages.upsert", message);
                }
            }
        });

        /** Call Event */
        Chisato.ev.on("call", async (calls) => {
            for (const call of calls) {
                this.emit("call", call);
            }
        });

        for (const ev of [
            // 'connection.update',
            // 'creds.update',
            "messaging-history.set",
            "chats.upsert",
            "chats.update",
            "chats.phoneNumberShare",
            "chats.delete",
            "presence.update",
            "contacts.upsert",
            "contacts.update",
            "messages.delete",
            "messages.update",
            "messages.media-update",
            // 'messages.upsert',
            "messages.reaction",
            "message-receipt.update",
            "groups.upsert",
            "groups.update",
            "group-participants.update",
            "blocklist.set",
            "blocklist.update",
            // 'call',
            "labels.edit",
            "labels.association",
        ])
            Chisato.ev.removeAllListeners(ev as keyof BaileysEventMap);

        for (const key of Object.keys(Chisato)) {
            this[key as keyof Client] = Chisato[key as keyof Chisato];
            if (!["ev", "ws"].includes(key)) delete Chisato[key as keyof Chisato];
        }
    }

    /** Read All Group Settings */
    private readevents() {
        const dir = path.join(__dirname, "../..", "handlers/settings");
        const readdir = fs
            .readdirSync(dir)
            .filter((file) => !file.includes("antiCall"))
            .filter((file) => file.endsWith(".js"));
        readdir.forEach(async (file) => {
            const setting = await (await import(`${dir}/${file}`)).default;
            settings.set(setting.name, setting);
        });
    }

    /** Read All Commands  */
    private readcommands() {
        const dir = path.join(__dirname, "../..", "commands");
        const readdir = fs.readdirSync(dir);
        readdir.forEach((dirName) => {
            const files = fs.readdirSync(`${dir}/${dirName}`).filter((file) => file.endsWith(".js"));
            files.forEach(async (file) => {
                let cmd = await (await import(`${dir}/${dirName}/${file}`)).default;
                commands.set(cmd.name, cmd);
                /** Detect File Changes */
                fs.watchFile(`${dir}/${dirName}/${file}`, async () => {
                    console.log(
                        clc.redBright(`[ ${clc.yellowBright("UPDATE")} ] ${clc.greenBright(file)} has been updated!`)
                    );
                    delete require.cache[require.resolve(`${dir}/${dirName}/${file}`)];
                    commands.delete(cmd.name);
                    cmd = await (await import(`${dir}/${dirName}/${file}`)).default;
                    commands.set(cmd.name, cmd);
                });
            });
        });
    }

    private reset() {
        // Reset user limit
        Cron("0 0 0 * * *", { timezone: this.config.timezone }, async () => {
            await Database.user.updateMany({
                where: {
                    userId: {
                        contains: "@s.whatsapp.net",
                    },
                    role: {
                        in: ["free"],
                    },
                },
                data: {
                    limit: this.config.limit.command,
                },
            });

            console.log(
                clc.green.bold("[ ") +
                    clc.white.bold("CRON") +
                    clc.green.bold(" ] ") +
                    clc.yellow.bold("Reset user limit...")
            );
        });
    }

    /** Beautify Logger */
    public log = (type: "status" | "info" | "error" | "eval" | "exec" | "connect", text: string, text2?: string) => {
        switch (type.toLowerCase()) {
            case "status":
                return console.log(clc.green.bold("["), clc.yellow.bold(text), clc.green.bold("]"), clc.blue(text2));
            case "info":
                return console.log(clc.green.bold("["), clc.yellow.bold("INFO"), clc.green.bold("]"), clc.blue(text));
            case "error":
                return console.log(clc.green.bold("["), clc.red.bold("ERROR"), clc.green.bold("]"), clc.blue(text));
            case "eval":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EVAL"),
                    clc.green.bold("]"),
                    clc.blue(this.time),
                    clc.green(text)
                );
            case "exec":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EXEC"),
                    clc.green.bold("]"),
                    clc.blue(this.time),
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

    public downloadMediaMessage = async (m: MessageSerialize): Promise<Buffer> => {
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

    public downloadAndSaveMediaMessage = async (
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

    public sendMediaAsSticker = async (
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
        return this.sendMessage(jid, await sticker.toMessage(), {
            quoted,
        });
    };

    /**
     * Decode Jid
     * @param jid
     * @returns
     */

    public decodeJid = (jid: string) => {
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || ({} as any);
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

    public sendText = async (
        jid: string,
        text: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        return this.sendMessage(jid, { text: text, ...options }, { quoted });
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

    public sendImage = async (
        jid: string,
        image: ChisatoMediaUpload,
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
        return this.sendMessage(jid, { image: media, caption: text, ...options }, { quoted });
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

    public sendVideo = async (
        jid: string,
        video: ChisatoMediaUpload,
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
        return this.sendMessage(
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

    public sendAudio = async (
        jid: string,
        audio: ChisatoMediaUpload,
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
        return this.sendMessage(
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

    public sendReaction = async (jid: string, emoji: string, m: proto.IMessageKey): Promise<WAProto.WebMessageInfo> => {
        return this.sendMessage(jid, {
            react: { text: emoji, key: m },
        });
    };

    /**
     * Get user name from jid if saved in store
     * @param {string} jid (group or private) number of the report
     * @param {boolean} withoutContact
     * @returns
     */

    public getName = async (jid: string) => {
        var id = jid.endsWith("@s.whatsapp.net") ? this.decodeJid(jid) : this.decodeJid(jid) + "@s.whatsapp.net";
        const User = new UserDatabase();
        const Group = new GroupDatabase();
        if (jid.endsWith("@g.us")) {
            const group = await Group.get(id);
            return group?.subject || PhoneNumber("+" + id.split("@")[0]).getNumber("international");
        } else {
            const user = await User.get(id);
            return user?.name || PhoneNumber("+" + id.split("@")[0]).getNumber("international");
        }
    };

    /**
     * Sending a Contact Message with Custom Array
     * @param {string} jid (group or private) number of the report
     * @param {object} contacts
     * @param {object} quoted
     * @param {string} opts
     */

    public sendContact = async (
        jid: string,
        contacts: string[],
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        const listContact = [];
        for (let i of contacts) {
            const number = i.split("@")[0];
            const pushname = await this.getName(i);
            const awesomeNumber = PhoneNumber("+" + number).getNumber("international");
            listContact.push({
                displayName: pushname,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${pushname}\nFN:${pushname}\nitem1.TEL;waid=${number}:${awesomeNumber}\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
            });
        }
        return this.sendMessage(
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

    public register: Chisato["register"];
    public requestRegistrationCode: Chisato["requestRegistrationCode"];
    public getOrderDetails: Chisato["getOrderDetails"];
    public getCatalog: Chisato["getCatalog"];
    public getCollections: Chisato["getCollections"];
    public productCreate: Chisato["productCreate"];
    public productDelete: Chisato["productDelete"];
    public productUpdate: Chisato["productUpdate"];
    public sendMessageAck: Chisato["sendMessageAck"];
    public sendRetryRequest: Chisato["sendRetryRequest"];
    public rejectCall: Chisato["rejectCall"];
    public getPrivacyTokens: Chisato["getPrivacyTokens"];
    public assertSessions: Chisato["assertSessions"];
    public relayMessage: Chisato["relayMessage"];
    public sendReceipt: Chisato["sendReceipt"];
    public sendReceipts: Chisato["sendReceipts"];
    public getButtonArgs: Chisato["getButtonArgs"];
    public readMessages: Chisato["readMessages"];
    public refreshMediaConn: Chisato["refreshMediaConn"];
    public waUploadToServer: Chisato["waUploadToServer"];
    public fetchPrivacySettings: Chisato["fetchPrivacySettings"];
    public updateMediaMessage: Chisato["updateMediaMessage"];
    public sendMessage: Chisato["sendMessage"];
    public groupMetadata: Chisato["groupMetadata"];
    public groupCreate: Chisato["groupCreate"];
    public groupLeave: Chisato["groupLeave"];
    public groupUpdateSubject: Chisato["groupUpdateSubject"];
    public groupRequestParticipantsList: Chisato["groupRequestParticipantsList"];
    public groupRequestParticipantsUpdate: Chisato["groupRequestParticipantsUpdate"];
    public groupParticipantsUpdate: Chisato["groupParticipantsUpdate"];
    public groupUpdateDescription: Chisato["groupUpdateDescription"];
    public groupInviteCode: Chisato["groupInviteCode"];
    public groupRevokeInvite: Chisato["groupRevokeInvite"];
    public groupAcceptInvite: Chisato["groupAcceptInvite"];
    public groupAcceptInviteV4: Chisato["groupAcceptInviteV4"];
    public groupGetInviteInfo: Chisato["groupGetInviteInfo"];
    public groupToggleEphemeral: Chisato["groupToggleEphemeral"];
    public groupSettingUpdate: Chisato["groupSettingUpdate"];
    public groupMemberAddMode: Chisato["groupMemberAddMode"];
    public groupJoinApprovalMode: Chisato["groupJoinApprovalMode"];
    public groupFetchAllParticipating: Chisato["groupFetchAllParticipating"];
    public processingMutex: Chisato["processingMutex"];
    public upsertMessage: Chisato["upsertMessage"];
    public appPatch: Chisato["appPatch"];
    public sendPresenceUpdate: Chisato["sendPresenceUpdate"];
    public presenceSubscribe: Chisato["presenceSubscribe"];
    public profilePictureUrl: Chisato["profilePictureUrl"];
    public onWhatsApp: Chisato["onWhatsApp"];
    public fetchBlocklist: Chisato["fetchBlocklist"];
    public fetchStatus: Chisato["fetchStatus"];
    public updateProfilePicture: Chisato["updateProfilePicture"];
    public removeProfilePicture: Chisato["removeProfilePicture"];
    public updateProfileStatus: Chisato["updateProfileStatus"];
    public updateProfileName: Chisato["updateProfileName"];
    public updateBlockStatus: Chisato["updateBlockStatus"];
    public updateLastSeenPrivacy: Chisato["updateLastSeenPrivacy"];
    public updateOnlinePrivacy: Chisato["updateOnlinePrivacy"];
    public updateProfilePicturePrivacy: Chisato["updateProfilePicturePrivacy"];
    public updateStatusPrivacy: Chisato["updateStatusPrivacy"];
    public updateReadReceiptsPrivacy: Chisato["updateReadReceiptsPrivacy"];
    public updateGroupsAddPrivacy: Chisato["updateGroupsAddPrivacy"];
    public updateDefaultDisappearingMode: Chisato["updateDefaultDisappearingMode"];
    public getBusinessProfile: Chisato["getBusinessProfile"];
    public resyncAppState: Chisato["resyncAppState"];
    public chatModify: Chisato["chatModify"];
    public cleanDirtyBits: Chisato["cleanDirtyBits"];
    public addChatLabel: Chisato["addChatLabel"];
    public removeChatLabel: Chisato["removeChatLabel"];
    public addMessageLabel: Chisato["addMessageLabel"];
    public removeMessageLabel: Chisato["removeMessageLabel"];
    public star: Chisato["star"];
    public type: Chisato["type"];
    // public ws: Chisato["ws"];
    // public ev: Chisato["ev"];
    public authState: Chisato["authState"];
    public signalRepository: Chisato["signalRepository"];
    public user: Chisato["user"];
    public generateMessageTag: Chisato["generateMessageTag"];
    public query: Chisato["query"];
    public waitForMessage: Chisato["waitForMessage"];
    public waitForSocketOpen: Chisato["waitForSocketOpen"];
    public sendRawMessage: Chisato["sendRawMessage"];
    public sendNode: Chisato["sendNode"];
    public logout: Chisato["logout"];
    public end: Chisato["end"];
    public onUnexpectedError: Chisato["onUnexpectedError"];
    public uploadPreKeys: Chisato["uploadPreKeys"];
    public uploadPreKeysToServerIfRequired: Chisato["uploadPreKeysToServerIfRequired"];
    public requestPairingCode: Chisato["requestPairingCode"];
    public waitForConnectionUpdate: Chisato["waitForConnectionUpdate"];
}
