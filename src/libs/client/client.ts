console.clear();
import {
    type DisconnectReason as DisconnectReasonType,
    type proto,
    type AnyMessageContent,
    type WAProto,
    type WACallEvent,
    type BaileysEventMap,
    type WAMediaUpload,
    type WASocket,
    type Contact,
    type WAMessage,
    delay,
} from "baileys";
import boomPkg from "@hapi/boom";
const { Boom } = boomPkg;
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
import { fileURLToPath, pathToFileURL } from "url";

/** Config */
import { commands, aliasIndex } from "./commands";
import { configService } from "../../core/config/config.service";

/** Types */
import type { SocketConfig } from "../../types/auth/socket";
import type TypedEventEmitter from "typed-emitter";
import type { Chisato, ChisatoMediaUpload } from "../../types/auth/chisato";
import type { Readable } from "stream";
import type { MessageSerialize } from "../../types/structure/serialize";

/** Utils */
import { Database, Validators, FileUtils } from "..";
import { useMultiAuthState, useSingleAuthState } from "../../auth";
import fileType from "file-type";
const { fromBuffer } = fileType;
import { StickerGenerator, StickerType } from "../../utils/converter/sticker";

/** Extensions */
import "../../shared/extensions/string.extensions";

/** Logger */
import { logger } from "../../core/logger";

/** Livs */
import { User as UserDatabase, Group as GroupDatabase } from "../database";

/** Context cache */
import { MessageContextBuilder } from "../../modules/handlers/message/message-context.builder";

type Events = {
    "group.update": (creds: proto.IWebMessageInfo) => void;
    "messages.upsert": (messages: proto.IWebMessageInfo) => void;
    "contacts.update": (contact: Partial<Contact>) => void;
    "group-participants.update": (update: {
        id: string;
        author?: string;
        participants: string[];
        action: "add" | "remove" | "promote" | "demote" | "modify";
    }) => void;
    "messages.revoke": (revoke: {
        key: proto.IMessageKey;
        update: {
            message?: proto.IMessage | null;
            messageStubType?: number;
            key?: proto.IMessageKey;
        };
    }) => void;
    call: (call: WACallEvent) => void;
};

let tryConnect = 0;

const RECONNECT_BASE_DELAY_MS = 2_000;
const RECONNECT_MAX_DELAY_MS = 60_000;

let baileysModule: any = null;

async function getBaileys() {
    if (!baileysModule) {
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const m = await dynamicImport("baileys");
        baileysModule = (typeof m.makeWASocket === 'function') ? m : (m.default ?? m);
    }
    return baileysModule;
}

export class Client extends (EventEmitter as new () => TypedEventEmitter<Events>) {
    get config(): Config { return configService.getConfig() as unknown as Config; }
    private package: any;
    private time: string;
    private socketConfig: SocketConfig;
    public logger = logger;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    public readyAt = 0;
    constructor(socketConfig: SocketConfig) {
        super();
        this.package = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
        this.socketConfig = socketConfig;
        moment.tz.setDefault(this.config.timezone);
        this.time = moment().format("DD/MM HH:mm:ss");
        this.readcommands();
    }

    /** Connect to Whatsapp */
    async connect(): Promise<void> {
        if (!process.env.DATABASE_URL) {
            this.logger.error("Please set DATABASE_URL in .env file!");
            return process.exit(0);
        }

        const baileys = await getBaileys();
        const { makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = baileys;

        const { version, isLatest } = await fetchLatestBaileysVersion({} as any);
        let { state, saveCreds, clearState } =
            (this.socketConfig?.session === "single" &&
                (await useSingleAuthState(Database))) ||
            (await useMultiAuthState(Database));

        if (state.creds.me?.id && !state.creds.registered) {
            this.logger.connect("Clearing incomplete session from previous pairing attempt...");
            await clearState();
            ({ state, saveCreds, clearState } =
                (this.socketConfig?.session === "single" &&
                    (await useSingleAuthState(Database))) ||
                (await useMultiAuthState(Database)));
        }

        const isRegistered = state.creds.registered;
        let pairMode = false;
        let pairingPhoneNumber = "";

        if (!isRegistered) {
            if (process.env.PAIRING_NUMBER) {
                pairMode = true;
                pairingPhoneNumber = process.env.PAIRING_NUMBER.replace(/[^0-9]/g, "");
            } else {
                const readline = await import("readline");
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });
                const ask = (q: string): Promise<string> =>
                    new Promise((resolve) => rl.question(q, resolve));

                this.logger.info("\n┌─────────────────────────────────────┐");
                this.logger.info("│        Choose Login Method          │");
                this.logger.info("├─────────────────────────────────────┤");
                this.logger.info("│  [1] QR Code                         │");
                this.logger.info("│  [2] Pairing Code                    │");
                this.logger.info("└─────────────────────────────────────┘");

                const choice = await ask(clc.greenBright(" ► ") + "Your choice (1/2): ");

                if (choice.trim() === "2") {
                    pairMode = true;
                    const phoneInput = await ask(
                        clc.greenBright(" ► ") + "Enter phone number with country code (e.g. 628xxx): "
                    );
                    pairingPhoneNumber = phoneInput.replace(/[^0-9]/g, "");
                }

                rl.close();
                console.log();
            }
        }

        /** Chisato as Client */
        const Chisato: Chisato = makeWASocket({
            ...this.socketConfig,
            version,
            printQRInTerminal: false,
            markOnlineOnConnect: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    Pino({ level: "silent" }).child({ level: "silent" })
                ),
            },
            logger: Pino({ level: "silent" }),
            cachedGroupMetadata: async (jid: string) => MessageContextBuilder.getCachedGroupMeta(jid),
        });

        const _requestPairingCode = Chisato.requestPairingCode;

        if (pairMode && pairingPhoneNumber && _requestPairingCode) {
            Chisato.ws.once("CB:iq,type:set,pair-device", async () => {
                await delay(5000)
                try {
                    this.logger.connect(`Requesting pairing code for +${pairingPhoneNumber}...`);
                    const code = await _requestPairingCode(pairingPhoneNumber, "CHISATOX");
                    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                    this.logger.connect("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    this.logger.connect(`Pairing Code : ${formattedCode}`);
                    this.logger.connect("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    this.logger.connect("Open WhatsApp > Linked Devices > Link with phone number");
                    this.logger.connect("Waiting for code to be entered...");
                } catch (error) {
                    this.logger.connect(`Failed to get pairing code: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        }

        const scheduleReconnect = (label: string, opts?: { backoff?: boolean }): void => {
            if (this.reconnectTimer) return;
            const delay =
                opts?.backoff === false
                    ? RECONNECT_BASE_DELAY_MS
                    : Math.min(
                          RECONNECT_MAX_DELAY_MS,
                          RECONNECT_BASE_DELAY_MS * 2 ** tryConnect
                      ) + Math.floor(Math.random() * 1000);
            tryConnect++;
            this.logger.status(
                label,
                `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${tryConnect})...`
            );
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, delay);
        };

        /** Connection Update */
        Chisato.ev?.on("connection.update", async (connections) => {
            const { lastDisconnect, connection, qr } = connections;

            if (qr && !pairMode) {
                this.logger.status(

                    "connect",
                    "QR Code received! Please scan the QR code below:"
                );
                qrcode.generate(qr, { small: true });
            }

            if (connection === "connecting") {
                this.logger.info(
                    `Registered ${commands.size} Commands — connecting...`
                );
            } else if (connection === "close") {
                let reason = new Boom(lastDisconnect?.error)?.output
                    ?.statusCode;
                switch (reason) {
                    case DisconnectReason.restartRequired:
                        // Normal post-pairing restart — reconnect fast, no backoff.
                        scheduleReconnect(`${reason}`, { backoff: false });
                        break;

                    case DisconnectReason.connectionReplaced:
                        this.logger.status(
                            `${reason}`,
                            "Connection Replaced! Another session is using this number. Auto-reconnect stopped to avoid a session conflict."
                        );
                        break;

                    case DisconnectReason.loggedOut:
                        this.logger.status(
                            `${reason}`,
                            "Session Logged Out! Clearing session — re-login (QR/pairing) required."
                        );
                        await clearState();
                        tryConnect = 0;
                        scheduleReconnect(`${reason}`, { backoff: false });
                        break;

                    case DisconnectReason.forbidden:
                        this.logger.status(
                            `${reason}`,
                            "FORBIDDEN (403) — the account appears blocked/banned by WhatsApp."
                        );
                        this.logger.status(
                            `${reason}`,
                            "Auto-reconnect STOPPED to avoid deepening the block. Check the number on a phone, wait it out, then restart the bot manually."
                        );
                        break;

                    case DisconnectReason.unavailableService:
                        if (tryConnect < 5) {
                            scheduleReconnect(`${reason}`);
                        } else {
                            this.logger.status(
                                `${reason}`,
                                "Service still unavailable after several attempts. Auto-reconnect paused — restart manually if it persists."
                            );
                        }
                        break;

                    case DisconnectReason.multideviceMismatch:
                    case DisconnectReason.badSession:
                        if (tryConnect < 2) {
                            scheduleReconnect(`${reason}`);
                        } else {
                            this.logger.status(
                                `${reason}`,
                                "Session unrecoverable — clearing session. Re-scan QR / re-pair required."
                            );
                            await clearState();
                            tryConnect = 0;
                            scheduleReconnect(`${reason}`, { backoff: false });
                        }
                        break;

                    case DisconnectReason.connectionLost:
                    case DisconnectReason.connectionClosed:
                    case DisconnectReason.timedOut:
                        scheduleReconnect(`${reason}`);
                        break;
                    default:
                        {
                            if (tryConnect < 2) {
                                tryConnect++;
                                this.logger.status(
                                    `${reason || "Unknown"}`,
                                    `Connection error! Retry attempt ${tryConnect}/2 in 3s...`
                                );
                                setTimeout(() => this.connect(), 3000);
                            } else {
                                this.logger.status(
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
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                this.readyAt = Date.now();

                /** Logger */
                const userName = this.user?.name || "WhatsApp BOT";
                const userId = this.user?.id?.split(":")[0] || "Unknown";
                cfonts.say("ChisatoBOT", this.config.cfonts);

                const dw = (s: string) => [...s].reduce((n, c) => {
                    const cp = c.codePointAt(0)!;
                    return n + (cp >= 0x1100 && (cp <= 0x9FFF || (cp >= 0xF900 && cp <= 0xFFEF) || (cp >= 0x20000 && cp <= 0x2FFFF)) ? 2 : 1);
                }, 0);

                const rows: [string, string][] = [
                    ["Creator", "Tobz"],
                    ["Name",    userName],
                    ["Number",  userId],
                    ["Version", this.package.version],
                    ["WA Web",  version.join(".")],
                    ["Latest",  isLatest ? "YES" : "NO"],
                ];

                const KEY_W = Math.max(...rows.map(([k]) => k.length));
                const VAL_W = Math.max(...rows.map(([, v]) => dw(v)));
                const BOX_W = KEY_W + VAL_W + 5; 

                console.log(clc.blackBright("┌" + "─".repeat(BOX_W) + "┐"));
                for (const [k, v] of rows) {
                    const pad = " ".repeat(VAL_W - dw(v));
                    console.log(
                        clc.blackBright("│ ") +
                        clc.cyan(k.padEnd(KEY_W)) +
                        clc.blackBright(" : ") +
                        clc.whiteBright(v) + pad +
                        clc.blackBright(" │")
                    );
                }
                console.log(clc.blackBright("└" + "─".repeat(BOX_W) + "┘"));
                this.logger.connect("Bot is ready to receive messages");
                const dashPort = process.env.DASHBOARD_PORT || "3000";
                this.logger.connect(`Dashboard server started on http://localhost:${dashPort}`);

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
                    this.logger.connect(
                        "Sending Online Notification to Owner..."
                    );
                    for (let owner of this.config.ownerNumber) {
                        await this.sendText(owner + "@s.whatsapp.net", str);
                    }
                    this.logger.connect(
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
                if (!message?.key?.remoteJid) continue;
                if (
                    message.message?.protocolMessage?.type === 3 ||
                    message?.messageStubType
                ) {
                    this.emit("group.update", message);
                } else if (message.message) {
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

        /**
         * Message Revoke Event (delete-for-everyone).
         *
         * `messages.update` is a high-frequency channel — it fires for status
         * receipts (sent/delivered/read), edits, reactions, poll updates, and
         * error acks in addition to revokes. We fast-fail every non-revoke
         * update so the hot path stays cheap (a single property compare for
         * the typical receipt case).
         *
         * REVOKE is signalled by `messageStubType === 1`
         * (proto.WebMessageInfo.StubType.REVOKE) plus `update.message` being
         * null/undefined. We re-emit a dedicated `messages.revoke` event so
         * downstream handlers don't need to know the filter.
         */
        Chisato.ev?.on("messages.update", (updates: any[]) => {
            if (!updates?.length) return;
            for (let i = 0; i < updates.length; i++) {
                const u = updates[i];
                if (u?.update?.messageStubType !== 1) continue;
                if (u.update.message != null) continue;
                this.emit("messages.revoke", u);
            }
        });

        /** Group Participants Update (real-time welcome/leave/promote/demote) */
        Chisato.ev?.on("group-participants.update", (update: any) => {
            this.logger.info(
                `[group-participants.update] received: ${update?.action} ${update?.id}`
            );
            this.emit("group-participants.update", update);
        });

        /** Populate cachedGroupMetadata on group upsert/update events */
        Chisato.ev?.on("groups.upsert", (groups: any[]) => {
            for (const g of groups) {
                if (g?.id) MessageContextBuilder.setCachedGroupMeta(g.id, g);
            }
        });
        Chisato.ev?.on("groups.update", (updates: any[]) => {
            for (const u of updates) {
                if (!u?.id) continue;
                const existing = MessageContextBuilder.getCachedGroupMeta(u.id);
                if (existing) {
                    MessageContextBuilder.setCachedGroupMeta(u.id, { ...existing, ...u });
                }
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
            // 'messages.update',  // kept — anti-delete listens to REVOKE here
            "messages.media-update",
            // 'messages.upsert',
            "messages.reaction",
            "message-receipt.update",
            "groups.upsert",
            "groups.update",
            // 'group-participants.update',
            "blocklist.set",
            "blocklist.update",
            // 'call',
            "labels.edit",
            "labels.association",
        ])
            Chisato.ev?.removeAllListeners(ev as keyof BaileysEventMap);

        for (const key of Object.keys(Chisato)) {
            if (key === "logger") { delete (Chisato as any)[key]; continue; }
            (this as any)[key] = (Chisato as any)[key];
            if (!["ev", "ws"].includes(key)) delete (Chisato as any)[key];
        }

        const { TemplateBuilder } = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../interactive/TemplateBuilder.js")).href);
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
        const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..", "commands");
        const readdir = fs.readdirSync(dir);
        readdir.forEach((dirName) => {
            const files = fs
                .readdirSync(`${dir}/${dirName}`)
                .filter((file) => file.endsWith(".js"));
            files.forEach(async (file) => {
                const filePath = `${dir}/${dirName}/${file}`;
                const fileUrl = pathToFileURL(filePath).href;
                let cmd = (await import(fileUrl)).default;
                commands.set(cmd.name, cmd);
                for (const alias of cmd.alias) aliasIndex.set(alias.toLowerCase(), cmd);
                if (process.env.NODE_ENV !== "production") {
                fs.watchFile(filePath, async () => {
                    this.logger.info(`Hot-reload: ${file} updated, reloading...`);
                    // Remove old aliases before reloading
                    if (cmd?.alias) for (const alias of cmd.alias) aliasIndex.delete(alias.toLowerCase());
                    commands.delete(cmd.name);
                    cmd = (await import(`${fileUrl}?update=${Date.now()}`)).default;
                    commands.set(cmd.name, cmd);
                    for (const alias of cmd.alias) aliasIndex.set(alias.toLowerCase(), cmd);
                });
                }
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

            this.logger.info("Cron: user limits have been reset");
        });
    }

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
        isVideo?: boolean,
        quoted?: MessageSerialize
    ) => {
        try {
            const stickerBuffer = await StickerGenerator.createSticker(buffer, {
                type: type || "default",
                pack: options.pack,
                author: options.author,
                quality: 50,
                isVideo
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
                (parsePhoneNumber("+" + id.split("@")[0]).number?.international ??
                "+" + id.split("@")[0])
            );
        } else {
            const user = await User.get(id);
            return (
                user?.name ||
                (parsePhoneNumber("+" + id.split("@")[0]).number?.international ??
                "+" + id.split("@")[0])
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
            const awesomeNumber = parsePhoneNumber("+" + number).number?.international ?? ("+" + number);
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
}

// Declaration merging: tells TypeScript that Client instances also have all
// WASocket properties (assigned at runtime via the copy loop in connect()).
// Excludes 'ev' since Client already uses its own EventEmitter for client events.
export interface Client extends Omit<Chisato, 'ev' | 'logger'> {}
