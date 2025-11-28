import { Client } from "../../../libs";
import { MessageSerialize } from "../../../types/structure/serialize";
import { logger } from "../../../core/logger";
import { Group as GroupDatabase } from "../../../libs/database";
import moment from "moment-timezone";

export class AntiLinkHandler {
    private Database = {
        Group: new GroupDatabase(),
    };

    async handle(
        Chisato: Client,
        message: MessageSerialize,
        isOwner: boolean,
        isGroupAdmin: boolean
    ): Promise<void> {
        try {
            const { from, sender, body, pushName } = message;
            const time = moment().format("HH:mm:ss DD/MM");

            // Get group settings
            const groupData = await this.Database.Group.getSettings(from);

            if (!groupData) return;

            const antilink = groupData.antiLink;
            const antilinkMode = groupData.antiLinkMode;
            const antilinkList = groupData.antiLinkList;

            if (!antilink || isOwner || isGroupAdmin) return;

            let regex: RegExp;
            let regexProfile: RegExp;
            let caption =
                `*「 ANTILINK 」*\n\n` +
                `• *Name* : ${pushName}\n` +
                `• *Number* : @${sender.split("@")[0]}\n`;

            const sendLog = (platform: string) => {
                logger.info(
                    `${time} | Anti-Link detected ${platform} from ${pushName} in ${from}`
                );
            };

            for (let list of antilinkList) {
                let detected = false;
                let platform = "";

                switch (list) {
                    case "youtube":
                        regex =
                            /(https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+)|(https?:\/\/music\.youtube\.com\/watch\?v=[\w-]+&list=RD[\w-]+)|(https?:\/\/youtu\.be\/[\w-]+)/;
                        regexProfile =
                            /^(https?:\/\/)?(www\.)?(m\.)?youtube\.com\/(channel\/|user\/)[\w\d]{1,}$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "Youtube";
                            detected = true;
                        }
                        break;

                    case "facebook":
                        regex =
                            /^https?:\/\/(?:www|m)\.facebook\.com\/groups\/\d+\/permalink\/\d+\/\?mibextid=[a-zA-Z0-9]+$/;
                        regexProfile =
                            /^(https?:\/\/)?(www\.)?(m\.)?facebook\.com\/(profile\.php\?id=\d+|[\w.-]+)\/?$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "Facebook";
                            detected = true;
                        }
                        break;

                    case "instagram":
                        regex =
                            /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|stories)\/[\w\d-]+\/?(?:\?[\w\d-]+=[\w\d%&-]+)?)|(https?:\/\/(?:www\.)?instagram\.com\/[\w\d-]+\/?(?:\?[\w\d-]+=[\w\d%&-]+)?)/;
                        regexProfile =
                            /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?instagram\.com\/([a-zA-Z0-9_\.]+)\/?$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "Instagram";
                            detected = true;
                        }
                        break;

                    case "tiktok":
                        regex =
                            /^(https?:\/\/)?(www\.)?(tiktok\.com\/(@\w+\/video\/\d+)|vm\.tiktok\.com\/(\w+)|vt\.tiktok\.com\/(\w+))/;
                        regexProfile =
                            /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w\d-]+$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "Tiktok";
                            detected = true;
                        }
                        break;

                    case "twitter":
                        regex =
                            /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com\/(?:#!\/)?[a-zA-Z0-9_]+\/status(?:es)?\/|t\.co\/[a-zA-Z0-9]+|\w+\.twimg\.com\/(?:[\w]+\/)?(?:\w+\.)?([a-zA-Z0-9_]+)(?:\/[a-zA-Z0-9_]+)*\/?)\b/;
                        regexProfile =
                            /https:\/\/twitter\.com\/[a-zA-Z0-9_]{1,15}/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "Twitter";
                            detected = true;
                        }
                        break;

                    case "whatsapp":
                        regex =
                            /https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/;
                        regexProfile =
                            /^https:\/\/api\.whatsapp\.com\/.*$|^https:\/\/wa\.me\/.*$/;
                        if (regex.test(body) || regexProfile.test(body)) {
                            platform = "WhatsApp";
                            detected = true;
                        }
                        break;

                    case "all":
                        regex =
                            /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%.\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%\+.~#?&//=]*)/;
                        if (regex.test(body)) {
                            platform = "URL";
                            detected = true;
                        }
                        break;
                }

                if (detected) {
                    sendLog(platform);
                    caption += `• *Message* : Terdeteksi Mengirimkan URL ${platform}!`;
                    await Chisato.sendText(from, caption, message, {
                        mentions: [sender],
                    });

                    // Delete message if mode is delete or kick
                    if (antilinkMode === "delete" || antilinkMode === "kick") {
                        await Chisato.sendMessage(from, {
                            delete: {
                                remoteJid: from,
                                id: message.id,
                                participant: sender,
                            },
                        });
                    }

                    // Kick member if mode is kick
                    if (antilinkMode === "kick") {
                        await Chisato.groupParticipantsUpdate(
                            from,
                            [sender],
                            "remove"
                        );
                    }

                    break;
                }
            }
        } catch (error) {
            logger.error(
                `Anti-link handler error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
