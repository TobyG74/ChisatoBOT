import axios from "axios";
import cheerio from "cheerio";
import moment from "moment-timezone";
import clc from "cli-color";
import fstat from "fs";
import util from "util";
import path from "path";
import { exec } from "child_process";

/** Types */
import { Chisato } from "../types/client";
import { MessageSerialize } from "../types/serialize";
import { Group, Group as GroupType, Participant, User } from "@prisma/client";

/** Database */
import { Group as GroupDatabase, GroupSetting as GroupSettingDatabase, User as UserDatabase } from "../libs/database";

/** Utils */
import * as utils from "../utils";
import * as libs from "../libs";
const { commands, events, cooldowns } = libs;
const { converter } = utils;

/** Eval Marker */
const Axios = axios;
const Cheerio = cheerio;
const fs = fstat;
const Database = libs.Database;
const Utils = utils;
const Libs = libs;

export const messageUpsert = async (Chisato: Chisato, message: MessageSerialize, store: any) => {
    try {
        const config: Config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
        const time = moment().format("HH:mm:ss DD/MM");

        if (config.settings.autoReadStatus && message.key.remoteJid === "stataus@broadcast")
            await Chisato.readMessages([message.key]);

        if (message.key && message.key.remoteJid === "status@broadcast") return;
        if (!message.type || message.type === "protocolMessage") return;

        if (config.settings.autoReadMessage) await Chisato.readMessages([message.key]);

        const isGroup = message.isGroup;
        const fromMe = message.fromMe;
        const from = message.from;
        const sender = message.sender;
        const body = message.body;
        const type = message.type;
        const args = message.args;
        const arg = message.arg;
        const query = message.query;
        const pushName = message.pushName;
        const prefix = /^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?@#$%^&.©^]/gi.test(body)
            ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?@#$%^&.©^]/gi)[0]
            : config.prefix;

        /** Bot Config */
        const botNumber = Chisato.decodeJid(Chisato.user.id);
        const botName = Chisato.user.name;

        /** Checkers */
        const isOwner = [
            ...config.ownerNumber,
            Chisato.decodeJid(Chisato.user.id).replace("@s.whatsapp.net", ""),
        ].includes(sender.split("@")[0]);
        const isTeam = [
            ...config.teamNumber,
            ...config.ownerNumber,
            Chisato.decodeJid(Chisato.user.id).replace("@s.whatsapp.net", ""),
        ].includes(sender.split("@")[0]);

        if (!message.fromMe && config.settings.selfbot && !body.startsWith(prefix + "mode") && !isOwner) return;

        /** Database Class */
        const Group = new GroupDatabase();
        const User = new UserDatabase();
        const GroupSetting = new GroupSettingDatabase();

        /** User */
        let blockList: String[] = [];
        blockList = await Chisato.fetchBlocklist().catch(() => blockList);
        const userMetadata: User = sender && ((await User.get(sender)) ?? (await User.upsert(Chisato, sender)));

        /** Group */
        const groupSettingData =
            isGroup && ((await GroupSetting.get(from)) ?? (await GroupSetting.upsert(Chisato, from)));
        const groupMetadata = isGroup && ((await Group.get(from)) ?? (await Group.upsert(Chisato, from)));
        const groupName = isGroup && groupMetadata.subject;
        const groupDescription = isGroup && groupMetadata.desc;
        const groupParticipants: Participant[] = isGroup && groupMetadata.participants;
        const groupAdmins: Participant[] = isGroup && groupMetadata.participants.filter((v) => v.admin !== null);

        /** Checkers */
        const isGroupOwner = isGroup && !!groupAdmins.find((v) => v.id === sender && v.admin === "superadmin");
        const isGroupAdmin = isGroup && !!groupAdmins.find((v) => v.id === sender);
        const isBotAdmin = isGroup && !!groupAdmins.find((v) => v.id === botNumber);
        const isCmd = body.startsWith(prefix);
        const isBlock = blockList.includes(sender);
        const isBanned = isGroup && groupSettingData?.banned?.includes(sender);
        const isMute = isGroup && groupSettingData.mute;
        const isLimit = userMetadata.limit === 0;
        const isAfk = userMetadata?.afk?.status ?? false;
        const isPremium = userMetadata.role === "premium";

        /** Commands */
        const cmd = isCmd && body.replace(prefix, "").split(/ +/).shift().toLowerCase();
        const command =
            commands.get(cmd) ?? Array.from(commands.values()).find((v) => v.alias.find((x) => x.toLowerCase() == cmd));

        /** Check User Premium */
        if (userMetadata.role === "premium") {
            if (userMetadata.expired < Date.now()) {
                await User.update(sender, { role: "user", expired: 0 });
                Chisato.sendText(sender, `Your premium has expired!`, message);
            }
        }

        /** Command Logger From Block or Banned Sender */
        if (command && (isBlock || isBanned)) {
            return console.log(
                clc.green.bold("[ ") +
                    clc.red.bold("CMDS") +
                    clc.green.bold(" ] ") +
                    clc.blue(time) +
                    " from " +
                    clc.magenta.bold(pushName) +
                    " in " +
                    clc.yellow.bold(groupName) +
                    " | " +
                    clc.green.bold(command.name)
            );
        }

        /** Mute Bot From Group */
        if (isMute && command && command.name !== "unmute") {
            return console.log(
                clc.green.bold("[ ") +
                    clc.yellow.bold("MUTE") +
                    clc.green.bold(" ] ") +
                    clc.blue(time) +
                    " from " +
                    clc.magenta.bold(pushName) +
                    " in " +
                    clc.yellow.bold(groupName) +
                    " | " +
                    clc.green.bold(command.name)
            );
        }

        /** Command Logger */
        if (command && !isGroup) {
            console.log(
                clc.green.bold("[ ") +
                    clc.yellow.bold("CMDS") +
                    clc.green.bold(" ] ") +
                    clc.blue(time) +
                    " from " +
                    clc.magenta.bold(pushName) +
                    " | " +
                    clc.green.bold(command.name)
            );
        }
        if (command && isGroup) {
            console.log(
                clc.green.bold("[ ") +
                    clc.yellow.bold("CMDS") +
                    clc.green.bold(" ] ") +
                    clc.blue(time) +
                    " from " +
                    clc.magenta.bold(pushName) +
                    " in " +
                    clc.yellow.bold(groupName) +
                    " | " +
                    clc.green.bold(command.name)
            );
        }
        /** Message Logger */
        if (!command && isGroup && !message.fromMe) {
            if (!(body.startsWith(">> ") || body.startsWith("$ ")))
                console.log(
                    clc.green.bold("[ ") +
                        clc.cyan.bold("CHAT") +
                        clc.green.bold(" ] ") +
                        clc.blue(time) +
                        " from " +
                        clc.magenta.bold(pushName) +
                        " in " +
                        clc.yellow.bold(groupName) +
                        " | " +
                        clc.green.bold(body.replace(/\n/g, " ").slice(0, 50))
                );
        }
        if (!command && !isGroup && !message.fromMe) {
            if (!(body.startsWith(">>") || body.startsWith("$ ")))
                console.log(
                    clc.green.bold("[ ") +
                        clc.cyan.bold("CHAT") +
                        clc.green.bold(" ] ") +
                        clc.blue(time) +
                        " from " +
                        clc.magenta.bold(pushName) +
                        " | " +
                        clc.green.bold(body.replace(/\n/g, " ").slice(0, 50))
                );
        }

        /** Command Helper */
        if (command) {
            if (/(-H|-h|-help|-Help|-HELP)/.test(args[0])) {
                const str =
                    `*「 HELPER 」*\n\n` +
                    `• Name : ${command.name}\n` +
                    `• Alias : ${command.alias.map((e) => e.toString())}\n` +
                    `• Category : ${command.category}\n` +
                    `• Description : ${command.description}\n` +
                    `${
                        config.maintenance.includes(command.name)
                            ? `• Maintenance : ${config.maintenance.includes(command.name)}\n`
                            : ""
                    }` +
                    `${command.usage ? `• Usage : ${command.usage}\n` : ""}` +
                    `${command.example ? `• Example : \n${command.example}` : ""}`;
                return Chisato.sendText(from, str, message);
            }
        }

        /** Command Maintennace */
        if (command) {
            if (/(-M|-m|-maintenance|-Maintenance|-MAINTENNACE)/.test(args[0]) && isOwner) {
                if (config.maintenance.includes(command.name)) {
                    /** Remove Command from Maintenance */
                    config.maintenance.splice(config.maintenance.indexOf(command.name), 1);
                    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                    return Chisato.sendText(from, `*「 MAINTENANCE 」*\n\n${command.name} is now Online!`, message);
                } else {
                    /** Push Command to Maintenance */
                    config.maintenance.push(command.name);
                    fs.writeFileSync("./config.json", JSON.stringify(config, null, 4));
                    return Chisato.sendText(
                        from,
                        `*「 MAINTENANCE 」*\n\n${command.name} is now Maintenance!`,
                        message
                    );
                }
            }
        }

        /** Mute Bot in Group */
        if (groupSettingData.mute && command && command.name !== "unmute" && !(isGroupAdmin || isOwner)) return;

        if (command) {
            /** Limit Reached */
            if (command.limit && isLimit && config.settings.useLimit)
                return Chisato.sendText(
                    from,
                    "Sorry, you've touched your limit today. Please try again tomorrow",
                    message
                );
            /** Cooldown */
            if (cooldowns.has(sender + command.name) && config.settings.useCooldown) {
                const remaining = (Date.now() - cooldowns.get(sender + command.name)) / 1000;
                return Chisato.sendText(
                    from,
                    `Sorry, please wait ${remaining.toFixed(1)} seconds to use this command again`,
                    message
                );
            }
            /** Maintenance */
            if (config.maintenance.includes(command.name) && !isOwner)
                return Chisato.sendText(from, "*「 ! 」* Sorry, this command is currently under Maintenance!", message);
            /** Send Examples of Command usage */
            if (command.example && args.length === 0)
                return Chisato.sendText(from, `Example : ${command.example}`, message);
            /** Only the Owner Can Use Commands */
            if (command.isOwner && !isOwner)
                return Chisato.sendText(
                    from,
                    "*「 ! 」* Sorry, This command can only be used by the Bot Owner!",
                    message
                );
            /** Can only be used in Group Message */
            if (command.isGroup && !isGroup)
                return Chisato.sendText(from, "*「 ! 」* Sorry, This command can only be used in Groups!", message);
            /** Can only be used in Private Message */
            if (command.isPrivate && isGroup)
                return Chisato.sendText(
                    from,
                    "*「 ! 」* Sorry, this command can only be used in private message!",
                    message
                );
            /** Only the Group Admins Can Use Commands */
            if (command.isGroupAdmin && !isGroupAdmin)
                return Chisato.sendText(
                    from,
                    "*「 ! 」* Sorry, This command can only be used by Group Admins!",
                    message
                );
            /** Only the Group Owner Can Use Commands */
            if (command.isGroupOwner && !isGroupOwner)
                return Chisato.sendText(
                    from,
                    "*「 ! 」* Sorry, This command can only be used by Group Owner!",
                    message
                );
            /** Only works if the bot is a Group Admin */
            if (command.isBotAdmin && !isBotAdmin)
                return Chisato.sendText(
                    from,
                    "*「 ! 」* Sorry, Bots are not Group Admins! Make Bot as Group Admin for command to work!",
                    message
                );
            /** Process */
            if (command.isProcess) await Chisato.sendReaction(from, "👌", message.key);

            /** Exec Function */
            if (typeof command.run === "function")
                command.run({
                    Chisato,
                    prefix,
                    command,
                    arg,
                    args,
                    query,
                    body,
                    from,
                    sender,
                    message,
                    botNumber,
                    botName,
                    isOwner,
                    isGroup,
                    isGroupAdmin,
                    isGroupOwner,
                    isBotAdmin,
                    Database: {
                        Group,
                        GroupSetting,
                        User,
                    },
                    groupName,
                    groupDescription,
                    groupParticipants,
                    groupAdmins,
                    groupMetadata,
                    groupSettingData,
                    userMetadata,
                });

            /** Update Limit */
            if (userMetadata.role !== "premium" && !isTeam && config.settings.useLimit)
                User.update(sender, { limit: userMetadata.limit - 1 });

            /** Update Cooldown */
            if (config.settings.useCooldown && command.cooldown && !isPremium && !isOwner) {
                cooldowns.set(sender + command.name, Date.now());
                setTimeout(() => cooldowns.delete(sender + command.name), command.cooldown * 1000);
            }
        }

        /** Check Afk from user */
        if (isAfk) {
            User.update(sender, { afk: { status: false, reason: null, since: 0 } });
            const afkData = userMetadata?.afk;
            const since = afkData?.since && Libs.getRemaining(afkData.since);
            Chisato.sendText(
                from,
                `*「 AFK 」*\n\n@${sender.split("@")[0]} has been back from AFK since ${since}`,
                message,
                {
                    mentions: [sender],
                }
            );
        }

        /** Check Afk with Mentions User */
        if (message.mentions.length !== 0 && message.mentions) {
            if (message.mentions) {
                for (const mention of message.mentions) {
                    const afkData = (await User.get(mention))?.afk;
                    const since = afkData?.since && Libs.getRemaining(afkData.since);
                    const reason = afkData?.reason;
                    if (afkData?.status) {
                        return Chisato.sendText(
                            from,
                            `*「 AFK 」*\n\n@${mention.split("@")[0]} is AFK\nSince : ${since}\nReason : ${reason}`,
                            message,
                            {
                                mentions: [mention],
                            }
                        );
                    }
                }
            }
        } else if (message.quoted) {
            const afkData = (await User.get(message.quoted.sender)).afk;
            const since = afkData?.since && Libs.runtime((Date.now() - afkData.since) / 60 / 60);
            const reason = afkData?.reason;
            if (afkData?.status) {
                return Chisato.sendText(
                    from,
                    `*「 AFK 」*\n\n@${
                        message.quoted.sender.split("@")[0]
                    } is AFK\nSince : ${since}\nReason : ${reason}`,
                    message,
                    {
                        mentions: [message.quoted.sender],
                    }
                );
            }
        }

        /** Evaled */
        if (body.startsWith(">> ") && isTeam) {
            new Promise((resolve, reject) => {
                try {
                    const evalCmd = eval("(async() => {" + arg + "})()");
                    resolve(evalCmd);
                } catch (err) {
                    reject(err);
                }
            })
                .then((res) =>
                    Chisato.sendText(from, util.inspect(res, false), message).catch((err) => Chisato.log("error", err))
                )
                .catch((err) =>
                    Chisato.sendText(from, util.inspect(err, true), message).catch((err) => Chisato.log("error", err))
                )
                .finally(() => Chisato.log("eval", body.replace(">> ", "").replace(/\n/g, " ").slice(0, 50)));
        }

        /** Exec */
        if (body.startsWith("$") && isTeam) {
            new Promise((resolve, reject) => {
                exec(`${arg}`, { windowsHide: true }, (err, stdout, stderr) => {
                    if (err) return reject(err);
                    if (stderr) return reject(stderr);
                    resolve(stdout);
                });
            })
                .then((res) => Chisato.sendText(from, util.inspect(res, true), message))
                .catch((err) => Chisato.sendText(from, util.inspect(err, true), message))
                .finally(() => Chisato.log("exec", body.replace("$ ", "").replace(/\n/g, " ").slice(0, 50)));
        }

        /** All Events from Bot Messages */
        events.forEach(async (event) => {
            if (event.isGroup && !isGroup) return;
            if (event.isBotAdmin && !isBotAdmin) {
                if (event.name === "antilink") {
                    if (groupSettingData[event.name].status) {
                        await GroupSetting.update(from, {
                            [event.name]: {
                                status: false,
                                mode: groupSettingData[event.name].mode,
                                list: groupSettingData[event.name].list,
                            },
                        });
                        return await Chisato.sendText(
                            from,
                            `Hello, Currently the bot is not a Group Admin. ${event.name} will be turned off automatically`
                        );
                    }
                } else {
                    if (groupSettingData[event.name]) {
                        await GroupSetting.update(from, { [event.name]: false });
                        return await Chisato.sendText(
                            from,
                            `Hello, Currently the bot is not a Group Admin. ${event.name} will be turned off automatically`
                        );
                    }
                }
            }
            if (typeof event.run === "function")
                event.run({
                    name: event.name,
                    time,
                    Chisato,
                    prefix,
                    body,
                    from,
                    pushName,
                    sender,
                    message,
                    Database: {
                        Group,
                        GroupSetting,
                        User,
                    },
                    isOwner,
                    isGroupAdmin,
                    groupName,
                });
        });
    } catch (e) {
        console.log(e);
    }
};
