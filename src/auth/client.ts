console.clear();
import makeWASocket, {
    makeInMemoryStore,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestWaWebVersion,
} from "baileys";
import { Boom } from "@hapi/boom";
import fs from "fs";
import clc from "cli-color";
import cfonts from "cfonts";
import Pino from "pino";
import path from "path";

/** Config */
import { commands, events } from "../libs/client/commands";

/** Types */
import type { Chisato } from "../types/client";
import type { SocketConfig } from "../types/auth/connect";

/** Handlers */
import * as handlers from "../handlers";

/** Utils */
import { converter, resetUserLimit } from "../utils";
import { Database, sendmessage, serialize } from "../libs";
import { useMultiAuthState, useSingleAuthState } from "./auth";

const store = makeInMemoryStore({
    logger: Pino({ level: "silent", stream: "store" }),
});

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

export class Client {
    private sendmessage = sendmessage;
    private config: Config;
    private package: any;
    constructor() {
        this.config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
        this.package = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
        this.sendmessage = sendmessage;
        this.readcommands();
        this.readevents();
    }

    /** Connect to Whatsapp */
    async connect(socketConfig: SocketConfig) {
        const { version, isLatest } = await fetchLatestWaWebVersion(null);
        const { state, saveCreds, clearState } =
            (socketConfig?.session === "single" && (await useSingleAuthState(Database))) ||
            (await useMultiAuthState(Database));

        /** Chisato as Client */
        let Chisato = makeWASocket({
            ...socketConfig,
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "silent" }).child({ level: "silent" })),
            },
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
            },
        }) as Chisato;

        this.sendmessage(Chisato, store);

        /** Connection Update */
        Chisato.ev.on("connection.update", async (connections) => {
            const { lastDisconnect, connection } = connections;
            if (connection === "connecting") {
                Chisato.log("connect", `Successfully Registered ${commands.size} Commands!`);
                Chisato.log("connect", `Successfully Registered ${events.size} Events!`);
            } else if (connection === "close") {
                let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                switch (reason) {
                    case DisconnectReason.restartRequired:
                        {
                            Chisato.log("status", `${reason}`, "Restarting...");
                            this.connect(socketConfig);
                        }
                        break;
                    case DisconnectReason.connectionLost:
                        {
                            Chisato.log("status", `${reason}`, "Connection Lost! Reconnecting...");
                            this.connect(socketConfig);
                        }
                        break;
                    case DisconnectReason.connectionClosed:
                        {
                            Chisato.log("status", `${reason}`, "Connection Closed! Reconnecting...");
                            this.connect(socketConfig);
                        }
                        break;
                    case DisconnectReason.connectionReplaced:
                        {
                            Chisato.log("status", `${reason}`, "Connection Replaced! Reconnecting...");
                            this.connect(socketConfig);
                        }
                        break;
                    case DisconnectReason.timedOut:
                        {
                            Chisato.log("status", `${reason}`, "Timed Out! Reconnecting...");
                            this.connect(socketConfig);
                        }
                        break;
                    case DisconnectReason.loggedOut:
                        {
                            Chisato.log("status", `${reason}`, "Session has been Logged Out! Please re-scan QR!");
                            await clearState();
                        }
                        break;
                    case DisconnectReason.multideviceMismatch:
                        {
                            Chisato.log("status", `${reason}`, "Multidevice Mismatch! Please re-scan QR!");
                            await clearState();
                        }
                        break;
                    case DisconnectReason.badSession:
                        {
                            Chisato.log("status", `${reason}`, "Bad Session! Please re-scan QR!");
                            await clearState();
                        }
                        break;
                    default: {
                        Chisato.log("status", `${reason}`, "Another Reason! Try to re-scan QR!");
                        await clearState();
                    }
                }
            } else if (connection === "open") {
                cfonts.say(Chisato.user.name || "WhatsApp BOT", this.config.cfonts);
                Chisato.log("connect", "Success Connected!");
                Chisato.log("connect", "Creator : Tobz");
                Chisato.log(
                    "connect",
                    `Name    : ${Chisato.user.name !== undefined ? Chisato.user.name : this.package.name}`
                );
                Chisato.log("connect", `Number  : ${Chisato.user.id.split(":")[0]}`);
                Chisato.log("connect", `Version : ${this.package.version}`);
                Chisato.log("connect", `WA Web Version : ${version}`);
                Chisato.log("connect", `Latest  : ${isLatest ? "YES" : "NO"}`);

                /** Sendmessage Config */
                this.sendmessage(Chisato, store);

                /** Sending Online Notification to Owner */
                if (this.config.settings.ownerNotifyOnline && this.config.ownerNumber.length !== 0) {
                    const str =
                        `「 *${Chisato.user.name}* 」\n\n` +
                        `• Name    : ${Chisato.user.name !== undefined ? Chisato.user.name : this.package.name}` +
                        `• Number  : ${Chisato.user.id.split(":")[0]}\n` +
                        `• Version : ${this.package.version}\n` +
                        `• WA Web Version : ${version}\n` +
                        `• Latest  : ${isLatest ? "YES" : "NO"}\n`;
                    Chisato.log("connect", "Sending Online Notification to Owner...");
                    for (let owner of this.config.ownerNumber) {
                        await Chisato.sendText(owner + "@s.whatsapp.net", str);
                    }
                    Chisato.log("connect", "Success Sending Online Notification to Owner!");
                }

                /** Go to Events */
                this.event(Chisato, store);
            }
        });

        /** Creds Update */
        Chisato.ev.on("creds.update", saveCreds);
        store.bind(Chisato.ev);
    }

    private event(Chisato: Chisato, store: any) {
        /** Message Event Handler */
        Chisato.ev.on("messages.upsert", async ({ messages }) => {
            for (const message of messages) {
                if (message?.messageStubType || message.message?.protocolMessage) {
                    serialize
                        .group(message)
                        .then(async (m) => {
                            await handlers.groupUpdate(Chisato, m).catch(() => void 0);
                        })
                        .catch(() => void 0);
                } else {
                    serialize
                        .message(Chisato, message)
                        .then(async (m) => {
                            await handlers.messageUpsert(Chisato, m, store).catch(() => void 0);
                        })
                        .catch(() => void 0);
                }
            }
        });

        /** Call Event Handler */
        Chisato.ev.on("call", async (call) => {
            serialize
                .call(call)
                .then(async (c) => {
                    await handlers.antiCall(Chisato, c).catch(() => void 0);
                })
                .catch(() => void 0);
        });
    }

    /** Read All Events */
    private readevents() {
        const dir = path.join(__dirname, "..", "handlers/events");
        const readdir = fs
            .readdirSync(dir)
            .filter((file) => !file.includes("antiCall"))
            .filter((file) => file.endsWith(".js"));
        readdir.forEach(async (file) => {
            const ev = await (await import(`${dir}/${file}`)).default;
            events.set(ev.name, ev);
        });
    }

    /** Read All Commands  */
    private readcommands() {
        const dir = path.join(__dirname, "..", "commands");
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
}
