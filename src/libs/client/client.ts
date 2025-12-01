console.clear();
import type {
    DisconnectReason as DisconnectReasonType,
    proto,
    AnyMessageContent,
    WAProto,
    WACallEvent,
    BaileysEventMap,
    WAMediaUpload,
    WASocket,
    Contact,
    WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { Cron } from "croner";
import fs from "fs";
import clc from "cli-color";
import cfonts from "cfonts";
import EventEmitter from "events";
import moment from "moment-timezone";
import Pino from "pino";
import path from "path";
import PhoneNumber, { parsePhoneNumber } from "awesome-phonenumber";
import qrcode from "qrcode-terminal";
import util from "util";

/** Config */
import { commands } from "./commands";

/** Types */
import type { SocketConfig } from "../../types/auth/socket";
import type TypedEventEmitter from "typed-emitter";
import type { Chisato, ChisatoMediaUpload } from "../../types/auth/chisato";
import type { Readable } from "stream";
import type { MessageSerialize } from "../../types/structure/serialize";

/** Utils */
import { Database, Validators, FileUtils } from "..";
import { useMultiAuthState, useSingleAuthState } from "../../auth";
import { fromBuffer } from "file-type";
import { StickerGenerator, StickerType } from "../../utils/converter/sticker";

/** Extensions */
import "../../shared/extensions/string.extensions";

/** Livs */
import { User as UserDatabase, Group as GroupDatabase } from "../database";

type Events = {
    "group.update": (creds: proto.IWebMessageInfo) => void;
    "messages.upsert": (messages: proto.IWebMessageInfo) => void;
    "contacts.update": (contact: Partial<Contact>) => void;
    call: (call: WACallEvent) => void;
};

let tryConnect = 0;

let baileysModule: any = null;

async function getBaileys() {
    if (!baileysModule) {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        baileysModule = await dynamicImport("@whiskeysockets/baileys");
    }
    return baileysModule;
}

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

        const baileys = await getBaileys();
        const { default: makeWASocket, fetchLatestWaWebVersion, makeCacheableSignalKeyStore, DisconnectReason, downloadContentFromMessage, toBuffer, jidDecode } = baileys;

        const { version, isLatest } = await fetchLatestWaWebVersion({} as any);
        const { state, saveCreds, clearState } =
            (this.socketConfig?.session === "single" &&
                (await useSingleAuthState(Database))) ||
            (await useMultiAuthState(Database));

        /** Chisato as Client */
        const Chisato: Chisato = makeWASocket({
            ...this.socketConfig,
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    Pino({ level: "silent" }).child({ level: "silent" })
                ),
            },
        });

        /** Connection Update */
        Chisato.ev?.on("connection.update", async (connections) => {
            const { lastDisconnect, connection, qr } = connections;

            if (qr) {
                const hasAuthenticatedSession =
                    state.creds.me?.id !== undefined;

                if (!hasAuthenticatedSession) {
                    this.log(
                        "connect",
                        "QR Code received! Please scan the QR code below:"
                    );
                    qrcode.generate(qr, { small: true });
                } else {
                    this.log(
                        "connect",
                        "Re-authenticating with saved session, skipping QR display..."
                    );
                }
            }

            if (connection === "connecting") {
                this.log(
                    "connect",
                    `Successfully Registered ${commands.size} Commands!`
                );
            } else if (connection === "close") {
                let reason = new Boom(lastDisconnect?.error)?.output
                    ?.statusCode;
                switch (reason) {
                    case DisconnectReason.restartRequired:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Restart required, reconnecting in 2s..."
                            );
                            setTimeout(() => this.connect(), 2000);
                        }
                        break;
                    case DisconnectReason.connectionLost:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Connection Lost! Reconnecting in 1s..."
                            );
                            setTimeout(() => this.connect(), 1000);
                        }
                        break;
                    case DisconnectReason.connectionClosed:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Connection Closed! Reconnecting in 1s..."
                            );
                            setTimeout(() => this.connect(), 1000);
                        }
                        break;
                    case DisconnectReason.connectionReplaced:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Connection Replaced! Another device connected."
                            );
                        }
                        break;
                    case DisconnectReason.timedOut:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Timed Out! Reconnecting in 2s..."
                            );
                            setTimeout(() => this.connect(), 2000);
                        }
                        break;
                    case DisconnectReason.loggedOut:
                        {
                            this.log(
                                "status",
                                `${reason}`,
                                "Session has been Logged Out! Please re-scan QR!"
                            );
                            await clearState();
                        }
                        break;
                    case DisconnectReason.forbidden:
                        if (tryConnect < 2) {
                            tryConnect++;
                            this.log(
                                "status",
                                `${reason}`,
                                `Forbidden! Retry attempt ${tryConnect}/2 in 3s...`
                            );
                            setTimeout(() => this.connect(), 3000);
                        } else {
                            this.log(
                                "status",
                                `${reason}`,
                                "Forbidden! Max retries reached. Please re-scan QR!"
                            );
                            await clearState();
                        }
                        break;
                    case DisconnectReason.unavailableService:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log(
                                    "status",
                                    `${reason}`,
                                    `Unavailable Service! Retry attempt ${tryConnect}/2 in 3s...`
                                );
                                setTimeout(() => this.connect(), 3000);
                            } else {
                                this.log(
                                    "status",
                                    `${reason}`,
                                    "Unavailable Service! Max retries reached. Please re-scan QR!"
                                );
                                await clearState();
                            }
                        }
                        break;
                    case DisconnectReason.multideviceMismatch:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log(
                                    "status",
                                    `${reason}`,
                                    `Multidevice Mismatch! Retry attempt ${tryConnect}/2 in 3s...`
                                );
                                setTimeout(() => this.connect(), 3000);
                            } else {
                                this.log(
                                    "status",
                                    `${reason}`,
                                    "Multidevice Mismatch! Max retries reached. Please re-scan QR!"
                                );
                                await clearState();
                            }
                        }
                        break;
                    case DisconnectReason.badSession:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log(
                                    "status",
                                    `${reason}`,
                                    `Bad Session! Retry attempt ${tryConnect}/2 in 3s...`
                                );
                                setTimeout(() => this.connect(), 3000);
                            } else {
                                this.log(
                                    "status",
                                    `${reason}`,
                                    "Bad Session! Max retries reached. Please re-scan QR!"
                                );
                                await clearState();
                            }
                        }
                        break;
                    default:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.log(
                                    "status",
                                    `${reason || "Unknown"}`,
                                    `Connection error! Retry attempt ${tryConnect}/2 in 3s...`
                                );
                                setTimeout(() => this.connect(), 3000);
                            } else {
                                this.log(
                                    "status",
                                    `${reason || "Unknown"}`,
                                    "Max retries reached. Please re-scan QR!"
                                );
                                await clearState();
                            }
                        }
                        break;
                }
            } else if (connection === "open") {
                tryConnect = 0;

                /** Logger */
                const userName = this.user?.name || "WhatsApp BOT";
                const userId = this.user?.id?.split(":")[0] || "Unknown";
                cfonts.say(userName, this.config.cfonts);
                this.log("connect", "Success Connected!");
                this.log("connect", "Bot is ready to receive messages");
                this.log("connect", "Creator : Tobz");
                this.log("connect", `Name    : ${userName}`);
                this.log("connect", `Number  : ${userId}`);
                this.log("connect", `Version : ${this.package.version}`);
                this.log("connect", `WA Web Version : ${version}`);
                this.log("connect", `Latest  : ${isLatest ? "YES" : "NO"}`);

                /** Reset Limit */
                this.reset();

                /** Sending Online Notification to Owner */
                if (
                    this.config.settings.ownerNotifyOnline &&
                    this.config.ownerNumber.length !== 0 &&
                    this.user
                ) {
                    const str =
                        `「 *${userName}* 」\n\n` +
                        `• Name    : ${userName}` +
                        `• Number  : ${userId}\n` +
                        `• Version : ${this.package.version}\n` +
                        `• WA Web Version : ${version}\n` +
                        `• Latest  : ${isLatest ? "YES" : "NO"}\n`;
                    this.log(
                        "connect",
                        "Sending Online Notification to Owner..."
                    );
                    for (let owner of this.config.ownerNumber) {
                        await this.sendText(owner + "@s.whatsapp.net", str);
                    }
                    this.log(
                        "connect",
                        "Success Sending Online Notification to Owner!"
                    );
                }
            }
        });

        /** Creds Update */
        Chisato.ev?.on("creds.update", saveCreds);

        /** Message Event */
        Chisato.ev?.on("messages.upsert", async ({ messages }) => {
            for (const message of messages) {
                if (
                    message.message?.protocolMessage?.type === 3 ||
                    message?.messageStubType
                ) {
                    this.emit("group.update", message);
                } else {
                    this.emit("messages.upsert", message);
                }
            }
        });

        /** Call Event */
        Chisato.ev?.on("call", async (calls) => {
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
            Chisato.ev?.removeAllListeners(ev as keyof BaileysEventMap);

        for (const key of Object.keys(Chisato)) {
            (this as any)[key] = (Chisato as any)[key];
            if (!["ev", "ws"].includes(key)) delete (Chisato as any)[key];
        }

        const { TemplateBuilder } = require("../interactive/TemplateBuilder");
        (this as any).TemplateBuilder = TemplateBuilder;

        const originalRelayMessage = (this as any).relayMessage.bind(this);
        (this as any).relayMessage = async (
            jid: string,
            message: any,
            opts?: any
        ) => {
            const hasInteractive =
                message?.viewOnceMessage?.message?.interactiveMessage;

            if (hasInteractive && (!opts || !opts.additionalNodes)) {
                const additionalNodes: any[] = [];
                additionalNodes.push({
                    tag: "biz",
                    attrs: {},
                    content: [
                        {
                            tag: "interactive",
                            attrs: { type: "native_flow", v: "1" },
                            content: [
                                {
                                    tag: "native_flow",
                                    attrs: { v: "9", name: "mixed" },
                                },
                            ],
                        },
                    ],
                });

                opts = { ...opts, additionalNodes };
            }

            return originalRelayMessage(jid, message, opts);
        };
    }

    /** Read All Commands  */
    private readcommands() {
        const dir = path.join(__dirname, "../..", "commands");
        const readdir = fs.readdirSync(dir);
        readdir.forEach((dirName) => {
            const files = fs
                .readdirSync(`${dir}/${dirName}`)
                .filter((file) => file.endsWith(".js"));
            files.forEach(async (file) => {
                let cmd = await (
                    await import(`${dir}/${dirName}/${file}`)
                ).default;
                commands.set(cmd.name, cmd);
                /** Detect File Changes */
                fs.watchFile(`${dir}/${dirName}/${file}`, async () => {
                    console.log(
                        clc.redBright(
                            `[ ${clc.yellowBright(
                                "UPDATE"
                            )} ] ${clc.greenBright(file)} has been updated!`
                        )
                    );
                    delete require.cache[
                        require.resolve(`${dir}/${dirName}/${file}`)
                    ];
                    commands.delete(cmd.name);
                    cmd = await (
                        await import(`${dir}/${dirName}/${file}`)
                    ).default;

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
    public log = (
        type: "status" | "info" | "error" | "eval" | "exec" | "connect",
        text: string | Error,
        text2?: string | Error
    ) => {
        switch (type.toLowerCase()) {
            case "status":
                return console.log(
                    clc.green.bold("["),
                    clc.yellow.bold(text),
                    clc.green.bold("]"),
                    clc.blue(util.inspect(text2))
                );
            case "info":
                return console.log(
                    clc.green.bold("["),
                    clc.yellow.bold("INFO"),
                    clc.green.bold("]"),
                    clc.blue(util.inspect(text))
                );
            case "error":
                return console.log(
                    clc.green.bold("["),
                    clc.red.bold("ERROR"),
                    clc.green.bold("]"),
                    clc.blue(util.inspect(text))
                );
            case "eval":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EVAL"),
                    clc.green.bold("]"),
                    clc.blue(this.time),
                    clc.green(util.inspect(text))
                );
            case "exec":
                return console.log(
                    clc.green.bold("["),
                    clc.magenta.bold("EXEC"),
                    clc.green.bold("]"),
                    clc.blue(this.time),
                    clc.green(util.inspect(text))
                );
            case "connect":
                return console.log(clc.green.bold("[ ! ]"), clc.blue(text));
        }
    };

    /** Download Media from Message
     * @param message
     * @returns {Promise<Buffer>}
     */

    public downloadMediaMessage = async (
        m: MessageSerialize
    ): Promise<Buffer> => {
        const baileys = await getBaileys();
        const { downloadContentFromMessage, toBuffer } = baileys;
        const mime = m.message[m.type].mimetype || "";
        const messageType = mime.split("/")[0];
        const stream = await downloadContentFromMessage(
            m.message[m.type],
            messageType
        );
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
        const baileys = await getBaileys();
        const { downloadContentFromMessage, toBuffer } = baileys;
        const mime = m.message[m.type].mimetype || "";
        const messageType = mime.split("/")[0];
        const pathfile = folder + `/${m.sender.split("@")[0]}_${Date.now()}`;
        const stream = await downloadContentFromMessage(
            m.message[m.type],
            messageType
        );
        let buffer: Buffer | null = await toBuffer(stream);
        const type = await fromBuffer(buffer);
        const filePath = attachExtension
            ? pathfile + "." + (type?.ext || "bin")
            : pathfile;
        fs.writeFileSync(filePath, buffer);
        buffer = null;
        return filePath;
    };

    /**
     * Send Media as Sticker
     * @param jid
     * @param options
     * @param buffer
     * @param type
     * @param quoted
     */

    public sendMediaAsSticker = async (
        jid: string,
        options: { pack: string; author: string },
        buffer: Buffer,
        type: StickerType,
        quoted?: MessageSerialize
    ) => {
        try {
            const stickerBuffer = await StickerGenerator.createSticker(buffer, {
                type: type || "default",
                pack: options.pack,
                author: options.author,
                quality: 80
            });

            return this.sendMessage!(jid, {
                sticker: stickerBuffer
            }, {
                quoted
            }) as Promise<WAMessage>;
        } catch (error) {
            throw new Error(`Failed to send sticker: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    /**
     * Decode Jid
     * @param jid
     * @returns
     */

    public decodeJid = async (jid: string | null | undefined) => {
        if (!jid) return "";
        if (/:\d+@/gi.test(jid)) {
            const baileys = await getBaileys();
            const { jidDecode } = baileys;
            const decode = jidDecode(jid) || ({} as any);
            return (
                (decode.user &&
                    decode.server &&
                    decode.user + "@" + decode.server) ||
                jid
            ).trim();
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
        return this.sendMessage!(
            jid,
            { text: text, ...options },
            { quoted }
        ) as Promise<WAProto.WebMessageInfo>;
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
        if (typeof image === "string" && Validators.isURL(image)) {
            media = { url: image };
        } else if (Buffer.isBuffer(image)) {
            media = image;
        } else {
            media = { stream: image as unknown as Readable };
        }
        return this.sendMessage!(
            jid,
            { image: media, caption: text, ...options },
            { quoted }
        ) as Promise<WAProto.WebMessageInfo>;
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
        if (typeof video === "string" && Validators.isURL(video)) {
            media = { url: video };
        } else if (Buffer.isBuffer(video)) {
            media = video;
        } else {
            media = { stream: video as unknown as Readable };
        }
        return this.sendMessage!(
            jid,
            {
                video: media,
                caption: text,
                gifPlayback: gifPlayback ? true : false,
                ...options,
            },
            { quoted }
        ) as Promise<WAProto.WebMessageInfo>;
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
        if (typeof audio === "string" && Validators.isURL(audio)) {
            media = { url: audio };
        } else if (Buffer.isBuffer(audio)) {
            media = audio;
        } else {
            media = { stream: audio as unknown as Readable };
        }
        return this.sendMessage!(
            jid,
            {
                audio: media,
                ptt: ptt,
                mimetype: !mimetype ? "audio/mp4" : mimetype,
                ...options,
            },
            { quoted }
        ) as Promise<WAProto.WebMessageInfo>;
    };

    /**
     * Send Reaction Message
     * @param jid (group or private)
     * @param emoji
     * @param m
     */

    public sendReaction = async (
        jid: string,
        emoji: string,
        m: proto.IMessageKey
    ): Promise<WAProto.WebMessageInfo> => {
        return this.sendMessage!(jid, {
            react: { text: emoji, key: m },
        }) as Promise<WAProto.WebMessageInfo>;
    };

    /**
     * Get user name from jid if saved in store
     * @param {string} jid (group or private) number of the report
     * @param {boolean} withoutContact
     * @returns
     */

    public getName = async (jid: string) => {
        var id = jid.endsWith("@s.whatsapp.net")
            ? await this.decodeJid(jid)
            : (await this.decodeJid(jid)) + "@s.whatsapp.net";
        const User = new UserDatabase();
        const Group = new GroupDatabase();
        if (jid.endsWith("@g.us")) {
            const group = await Group.get(id);
            return (
                group?.subject ||
                parsePhoneNumber("+" + id.split("@")[0]).number.international
            );
        } else {
            const user = await User.get(id);
            return (
                user?.name ||
                parsePhoneNumber("+" + id.split("@")[0]).number.international
            );
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
        const listContact: Array<{ displayName: string; vcard: string }> = [];
        for (let i of contacts) {
            const number = i.split("@")[0];
            const pushname = await this.getName(i);
            const awesomeNumber = parsePhoneNumber("+" + number).number.international;
            listContact.push({
                displayName: pushname,
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${pushname}\nFN:${pushname}\nitem1.TEL;waid=${number}:${awesomeNumber}\nitem1.X-ABLabel:Mobile\nEND:VCARD`,
            });
        }
        return this.sendMessage!(
            jid,
            {
                contacts: {
                    displayName: `${listContact.length} Kontak`,
                    contacts: listContact,
                },
                ...options,
            },
            { quoted }
        ) as Promise<WAProto.WebMessageInfo>;
    };

    /**
     * Sending Template Buttons Message
     * @param {string} jid (group or private) number of the report
     * @param {Buffer|string|Readable} image sending image with buffer or url
     * @param {string} caption caption for the message
     * @param {Array} templateButtons array of button objects (urlButton, callButton, quickReplyButton)
     * @param {string} footer footer text for the message
     * @param {object} quoted
     * @param {object} options
     * @returns
     */
    public sendTemplateButtons = async (
        jid: string,
        image: ChisatoMediaUpload | null,
        caption: string,
        templateButtons: Array<{
            urlButton?: { displayText: string; url: string };
            callButton?: { displayText: string; phoneNumber: string };
            quickReplyButton?: { displayText: string; id: string };
        }>,
        footer?: string,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        let media: WAMediaUpload | undefined;

        if (image) {
            if (typeof image === "string" && Validators.isURL(image)) {
                media = { url: image };
            } else if (Buffer.isBuffer(image)) {
                media = image;
            } else {
                media = { stream: image as unknown as Readable };
            }
        }

        const content: any = {
            caption,
            templateButtons: templateButtons.filter(
                (btn) => Object.keys(btn).length > 0
            ),
            footer: footer || "",
            ...options,
        };

        if (media) {
            content.image = media;
        }

        return this.sendMessage!(jid, content, {
            quoted,
        }) as Promise<WAProto.WebMessageInfo>;
    };

    /**
     * Sending Button Message with Hydrated Template (Legacy Support)
     * @param {string} jid (group or private) number of the report
     * @param {Buffer|string|Readable} image sending image with buffer or url
     * @param {string} caption caption for the message
     * @param {string} footer footer text for the message
     * @param {Array} buttons array of button objects (urlButton, callButton, quickReplyButton)
     * @param {object} quoted
     * @param {object} options
     * @returns
     */
    public sendButton = async (
        jid: string,
        image: ChisatoMediaUpload | null,
        caption: string,
        footer: string,
        buttons: Array<{
            urlButton?: { displayText: string; url: string };
            callButton?: { displayText: string; phoneNumber: string };
            quickReplyButton?: { displayText: string; id: string };
        }>,
        quoted?: MessageSerialize,
        options?: Partial<AnyMessageContent>
    ): Promise<WAProto.WebMessageInfo> => {
        const baileys = await getBaileys();
        const { generateWAMessageFromContent } = baileys;

        let imageMessage: any = undefined;
        if (image) {
            let media: WAMediaUpload;
            if (typeof image === "string" && Validators.isURL(image)) {
                media = { url: image };
            } else if (Buffer.isBuffer(image)) {
                media = image;
            } else {
                media = { stream: image as unknown as Readable };
            }

            const prepared = await this.sendMessage!(jid, {
                image: media,
            });
            if (prepared && prepared.message && prepared.message.imageMessage) {
                imageMessage = prepared.message.imageMessage;
            }
        }

        // Generate random template ID
        const randomString = (length: number): string => {
            const chars = "0123456789";
            let result = "";
            for (let i = 0; i < length; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }
            return result;
        };

        const templateId = randomString(16);

        // Convert buttons to hydrated format
        const hydratedButtons = buttons
            .map((btn, index) => {
                if (btn.urlButton) {
                    return {
                        urlButton: {
                            displayText: btn.urlButton.displayText,
                            url: btn.urlButton.url,
                        },
                        index,
                    };
                } else if (btn.callButton) {
                    return {
                        callButton: {
                            displayText: btn.callButton.displayText,
                            phoneNumber: btn.callButton.phoneNumber,
                        },
                        index,
                    };
                } else if (btn.quickReplyButton) {
                    return {
                        quickReplyButton: {
                            displayText: btn.quickReplyButton.displayText,
                            id: btn.quickReplyButton.id,
                        },
                        index,
                    };
                }
                return null;
            })
            .filter((btn) => btn !== null);

        // Create message structure
        const messageContent: any = {
            viewOnceMessage: {
                message: {
                    templateMessage: {
                        hydratedFourRowTemplate: {
                            hydratedContentText: caption,
                            hydratedFooterText: footer,
                            templateId: templateId,
                            hydratedButtons: hydratedButtons,
                        },
                        hydratedTemplate: {
                            hydratedContentText: caption,
                            hydratedFooterText: footer,
                            templateId: templateId,
                            hydratedButtons: hydratedButtons,
                        },
                    },
                },
            },
        };

        // Add image if provided
        if (imageMessage) {
            messageContent.viewOnceMessage.message.templateMessage.hydratedFourRowTemplate.imageMessage =
                imageMessage;
            messageContent.viewOnceMessage.message.templateMessage.hydratedTemplate.imageMessage =
                imageMessage;
        }

        // Generate message
        const msg = generateWAMessageFromContent(jid, messageContent, {
            userJid: this.user?.id || jid,
            quoted: quoted ? quoted.message : undefined,
            ...options,
        });

        // Ensure msg has proper structure
        if (!msg || !msg.key) {
            throw new Error("Failed to generate message");
        }

        // Send message using relayMessage
        await this.relayMessage!(jid, msg.message, {
            messageId: msg.key.id,
        });

        return msg as WAProto.WebMessageInfo;
    };

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
