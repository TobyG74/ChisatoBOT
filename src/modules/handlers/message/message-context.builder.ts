import type { Client } from "@libs/client/client";
import type { MessageSerialize } from "../../../types/structure/serialize";
import type { Database } from "../../../types/structure/commands";
import { BotConfig } from "@core/config";

export class MessageContextBuilder {
    static async build(
        Chisato: Client,
        message: MessageSerialize,
        config: BotConfig,
        database: Database
    ): Promise<MessageContext | null> {
        try {
            const { Group, User } = database;

            if (
                message.type === "interactiveMessage" ||
                message.type === "viewOnceMessage" ||
                message.type === "viewOnceMessageV2"
            ) {
                return null;
            }

            // Basic message data
            const body = message.body;
            const from = message.from;
            const sender = message.sender;
            const pushName = message.pushName;
            const type = message.type;
            const args = message.args;
            const arg = message.arg;
            const query = message.query;
            const isGroup = message.isGroup;
            const fromMe = message.fromMe;

            // Bot data
            const botNumber = await Chisato.decodeJid(Chisato.user.id);
            const botLid = Chisato.user.lid
            const botName = Chisato.user.name;
            const prefix =
                body && /^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?@#$%^&.©^]/gi.test(body)
                    ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?@#$%^&.©^]/gi)![0]
                    : config.prefix;

            // Check command
            const isCmd = body ? body.startsWith(prefix) : false;
            const cmd =
                isCmd && body
                    ? body
                          .replace(prefix, "")
                          .split(/ +/)
                          .shift()
                          ?.toLowerCase()
                    : undefined;

            // User data
            let blockList: string[] = [];
            try {
                blockList = await Chisato.fetchBlocklist();
            } catch (e) {
                // Ignore blocklist errors
            }

            const userMetadata = (await User.get(sender)) ??
                (await User.upsert(Chisato, sender, pushName));

            // Group data
            let groupMetadata: MessageContext["groupMetadata"] = undefined;
            let groupSettingData: MessageContext["groupSettingData"] = undefined;
            let groupName: string | undefined = undefined;
            let groupDescription: string | undefined = undefined;
            let groupParticipants: MessageContext["groupParticipants"] = undefined;
            let groupAdmins: MessageContext["groupAdmins"] = undefined;

            if (isGroup) {
                groupMetadata = (await Chisato.groupMetadata(from).catch(() => null) || (await Group.get(from))) ?? (await Group.upsert(Chisato, from));
                
                if (groupMetadata) {
                    groupSettingData = (await Group.get(from)) ?? (await Group.upsert(Chisato, from)).settings;
                    groupName = groupMetadata.subject;
                    groupDescription = groupMetadata.desc;
                    groupParticipants = groupMetadata.participants;
                    groupAdmins = groupMetadata.participants.filter(
                        (v) => v.admin !== null
                    );
                }
            }

            // Permissions
            const botNumberClean = botNumber
            const isOwner =
                fromMe ||
                sender === botNumber ||
                [...config.ownerNumber, botNumberClean].includes(
                    sender.split("@")[0]
                );

            const isTeam =
                fromMe ||
                sender === botNumber ||
                [
                    ...config.teamNumber,
                    ...config.ownerNumber,
                    botNumberClean,
                ].includes(sender.split("@")[0]);

            const isGroupAdmin =
                isGroup &&
                !!groupAdmins?.find((v) => v.phoneNumber === sender);
            const isGroupOwner =
                isGroup &&
                !!groupAdmins?.find(
                    (v) =>
                        v.phoneNumber === sender && v.admin === "superadmin"
                );
            const isBotAdmin =
                isGroup &&
                !!groupAdmins?.find((v) => v.phoneNumber === botNumber);
            const isBlock = blockList.includes(sender);
            const isBanned =
                isGroup && groupSettingData?.banned?.includes(sender);
            const isMute = isGroup && (groupSettingData?.mute ?? false);
            const isLimit = userMetadata?.limit === 0;
            const isPremium = userMetadata?.role === "premium";

            return {
                body,
                from,
                sender,
                pushName,
                type,
                args,
                arg,
                query,
                isGroup,
                fromMe,
                botNumber,
                botName,
                prefix,
                isOwner,
                isTeam,
                isGroupAdmin,
                isGroupOwner,
                isBotAdmin,
                isBlock,
                isBanned,
                isMute,
                isLimit,
                isPremium,
                groupName,
                groupDescription,
                groupParticipants,
                groupAdmins,
                groupMetadata,
                groupSettingData,
                userMetadata,
                blockList,
                isCmd,
                cmd: cmd || undefined,
            };
        } catch (error) {
            console.error("Error building message context:", error);
            return null;
        }
    }
}
