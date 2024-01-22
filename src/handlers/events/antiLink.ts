import clc from "cli-color";
import { ConfigEvents } from "../../types/commands";

export default <ConfigEvents>{
    name: "antilink",
    isGroup: true,
    isBotAdmin: true,
    async run({ Chisato, time, pushName, groupName, body, from, sender, message, Database, isOwner, isGroupAdmin }) {
        const { antilink } = await Database.GroupSetting.get(from);
        let regex: RegExp;
        let regexProfile: RegExp;
        if (antilink.status && !isOwner && !isGroupAdmin) {
            let caption =
                `*「 ANTILINK 」*\n\n` +
                `• *Name* : ${message.pushName}\n` +
                `• *Number* : @${message.sender.split("@")[0]}\n`;
            const sendLog = () => {
                return console.log(
                    clc.green.bold("[ ") +
                        clc.white.bold("ANTI LINK") +
                        clc.green.bold(" ] ") +
                        clc.blue(time) +
                        " from " +
                        clc.magenta.bold(pushName) +
                        " in " +
                        clc.yellow.bold(groupName)
                );
            };
            for (let list of antilink.list) {
                switch (list) {
                    case "youtube":
                        regex =
                            /(https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+)|(https?:\/\/music\.youtube\.com\/watch\?v=[\w-]+&list=RD[\w-]+)|(https?:\/\/youtu\.be\/[\w-]+)/;
                        regexProfile = /^(https?:\/\/)?(www\.)?(m\.)?youtube\.com\/(channel\/|user\/)[\w\d]{1,}$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL Youtube!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "facebook":
                        regex =
                            /^https?:\/\/(?:www|m)\.facebook\.com\/groups\/\d+\/permalink\/\d+\/\?mibextid=[a-zA-Z0-9]+$/;
                        regexProfile = /^(https?:\/\/)?(www\.)?(m\.)?facebook\.com\/(profile\.php\?id=\d+|[\w.-]+)\/?$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL Facebook!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "instagram":
                        regex =
                            /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|stories)\/[\w\d-]+\/?(?:\?[\w\d-]+=[\w\d%&-]+)?)|(https?:\/\/(?:www\.)?instagram\.com\/[\w\d-]+\/?(?:\?[\w\d-]+=[\w\d%&-]+)?)/;
                        regexProfile = /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?instagram\.com\/([a-zA-Z0-9_\.]+)\/?$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL Instagram!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "tiktok":
                        regex =
                            /^(https?:\/\/)?(www\.)?(tiktok\.com\/(@\w+\/video\/\d+)|vm\.tiktok\.com\/(\w+)|vt\.tiktok\.com\/(\w+))/;
                        regexProfile = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w\d-]+$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL Tiktok!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "twitter":
                        regex =
                            /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/(?:#!\/)?[a-zA-Z0-9_]+\/status(?:es)?\/|t\.co\/[a-zA-Z0-9]+|\w+\.twimg\.com\/(?:[\w]+\/)?(?:\w+\.)?([a-zA-Z0-9_]+)(?:\/[a-zA-Z0-9_]+)*\/?)\b/;
                        regexProfile = /https:\/\/twitter\.com\/[a-zA-Z0-9_]{1,15}/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL Twitter!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "whatsapp":
                        regex = /https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/;
                        regexProfile = /^https:\/\/api\.whatsapp\.com\/.*$|^https:\/\/wa\.me\/.*$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL WhatsApp!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                        break;
                    case "all":
                        regex =
                            /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%.\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%\+.~#?&//=]*)/;
                        if (regex.test(body)) {
                            sendLog();
                            caption += "• *Message* : Terdeteksi Mengirimkan URL!";
                            await Chisato.sendText(from, caption, message, { mentions: [sender] });
                            if (antilink.mode === "delete" || antilink.mode === "kick")
                                Chisato.sendMessage(from, {
                                    delete: {
                                        remoteJid: from,
                                        id: message.id,
                                        participant: message.sender,
                                    },
                                });
                            if (antilink.mode === "kick")
                                await Chisato.groupParticipantsUpdate(from, [sender], "remove");
                        }
                }
            }
        }
    },
};
