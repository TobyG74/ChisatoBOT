import {
    proto
} from "@whiskeysockets/baileys";
import { GroupSerialize } from "../../../types/structure/serialize";
import { Group as GroupDatabase } from "../../../libs/database";
import { Client } from "../../../libs";
import { logger } from "../../../core/logger";
import { createWelcomeImage, createLeaveImage } from "../../../utils/converter";
import path from "path";
import util from "util";

export class GroupUpdateHandler {
    private Database = {
        Group: new GroupDatabase(),
    };

    async handle(Chisato: Client, message: GroupSerialize): Promise<void> {
        try {
            const dynamicImport = new Function('specifier', 'return import(specifier)');
            const baileys = await dynamicImport("@whiskeysockets/baileys");
            const { proto } = baileys;
            
            const { parameters, from, participant, type, expiration, pushName } = message;

            if (!from || !participant) {
                logger.error("Group update: Missing required fields (from or participant)");
                return;
            }

            const { Group } = this.Database;
            
            let groupMetadata = await Group.get(from);
            if (!groupMetadata) {
                try {
                    groupMetadata = await Group.upsert(Chisato, from);
                } catch (upsertError) {
                    logger.error(
                        `Group update: Failed to upsert group metadata: ${
                            upsertError instanceof Error ? upsertError.message : String(upsertError)
                        }`
                    );
                }
            }
            
            if (!groupMetadata || !groupMetadata.subject) {
                return;
            }
            
            const GroupSetting = await Group.getSettings(from).catch(() => groupMetadata?.settings);
            const botNumber = await Chisato.decodeJid(Chisato.user.id);
            
            const groupName = groupMetadata.subject;

            const isBotAdmin = groupMetadata.participants
                ?.filter((v) => v.admin !== null)
                .map((v) => v.id)
                .includes(botNumber);

            const isNotify = GroupSetting?.notify;
            const isWelcome = GroupSetting?.welcome;
            const isLeave = GroupSetting?.leave;
            const isBanned = GroupSetting?.banned?.includes(participant);

            switch (type) {
                case proto.WebMessageInfo.StubType.GROUP_CHANGE_ANNOUNCE:
                    await this.handleAnnounceChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, {
                        announce: parameters[0] === "on" ? false : true,
                    });
                    logger.info(`Group announce setting updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_CHANGE_RESTRICT:
                    await this.handleRestrictChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, {
                        restrict: parameters[0] === "on" ? false : true,
                    });
                    logger.info(`Group restrict setting updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType
                    .GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
                    await this.handleJoinApprovalChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, {
                        joinApprovalMode: parameters[0] === "on" ? true : false,
                    });
                    logger.info(`Group join approval mode updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_MEMBER_ADD_MODE:
                    await this.handleMemberAddModeChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, {
                        memberAddMode: parameters[0] === "on" ? false : true,
                    });
                    logger.info(`Group member add mode updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.CHANGE_EPHEMERAL_SETTING:
                    await this.handleEphemeralChange(
                        Chisato,
                        from,
                        participant,
                        expiration,
                        isNotify
                    );
                    await Group.update(from, { ephemeralDuration: expiration });
                    logger.info(`Group ephemeral setting updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_CHANGE_SUBJECT:
                    await this.handleSubjectChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, { subject: parameters[0] });
                    logger.info(`Group subject updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_CHANGE_DESCRIPTION:
                    await this.handleDescriptionChange(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await Group.update(from, { desc: parameters[0] });
                    logger.info(`Group description updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_CHANGE_INVITE_LINK:
                    await this.handleInviteLinkChange(
                        Chisato,
                        from,
                        participant,
                        isNotify
                    );
                    logger.info(`Group invite link updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_CHANGE_ICON:
                    await this.handleIconChange(
                        Chisato,
                        from,
                        participant,
                        isNotify
                    );
                    logger.info(`Group icon updated for ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_PROMOTE:
                    await this.handleParticipantPromote(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await this.updateGroupMetadata(Chisato, from);
                    logger.info(`Group participant promoted in ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_DEMOTE:
                    await this.handleParticipantDemote(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        isNotify
                    );
                    await this.updateGroupMetadata(Chisato, from);
                    logger.info(`Group participant demoted in ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_ADD:
                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_INVITE:
                    await this.handleParticipantAdd(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        groupName,
                        isBanned,
                        isWelcome
                    );
                    await this.updateGroupMetadata(Chisato, from);
                    logger.info(`Group participant added in ${from}`);
                    break;

                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_LEAVE:
                case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_REMOVE:
                    await this.handleParticipantLeave(
                        Chisato,
                        from,
                        participant,
                        parameters,
                        botNumber,
                        isLeave
                    );
                    logger.info(`Group participant left or removed in ${from}`);
                    break;
            }
        } catch (error) {
            logger.error(
                `Group update handler error: ${
                    error instanceof Error ? util.inspect(error) : String(error)
                }`
            );
        }
    }

    private async handleAnnounceChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption =
            parameters[0] === "on"
                ? `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has restricted members from sending messages`
                : `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has opened restrictions on members sending messages`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleRestrictChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption =
            parameters[0] === "on"
                ? `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has restricted members from editing the group`
                : `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has opened members restrictions to edit group`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleJoinApprovalChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption =
            parameters[0] === "on"
                ? `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has enabled the Approval Mode for joining the group`
                : `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has disabled the Approval Mode for joining the group`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleMemberAddModeChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption =
            parameters[0] === "on"
                ? `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has disabled the Add other members setting. Now only Admin can invite Other Members`
                : `「 *GROUP CHANGE* 」\n\n@${
                      participant.split("@")[0]
                  } has enabled the Add other members setting. Now all members can invite Other Members`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleEphemeralChange(
        Chisato: Client,
        from: string,
        participant: string,
        expiration: number,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        let caption: string;
        switch (expiration) {
            case 86400:
                caption = `「 *GROUP CHANGE* 」\n\n@${
                    participant.split("@")[0]
                } has enabled disappearing messages for 24 hours`;
                break;
            case 604800:
                caption = `「 *GROUP CHANGE* 」\n\n@${
                    participant.split("@")[0]
                } has enabled disappearing messages for 7 days`;
                break;
            case 7776000:
                caption = `「 *GROUP CHANGE* 」\n\n@${
                    participant.split("@")[0]
                } has enabled disappearing messages for 90 days`;
                break;
            case 0:
                caption = `「 *GROUP CHANGE* 」\n\n@${
                    participant.split("@")[0]
                } has disabled disappearing messages`;
                break;
            default:
                return;
        }

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleSubjectChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption = `「 *GROUP CHANGE* 」\n\n@${
            participant.split("@")[0]
        } has changed the group name to *${parameters[0]}*`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleDescriptionChange(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption = `「 *GROUP CHANGE* 」\n\n@${
            participant.split("@")[0]
        } has changed the group description to \n\n${parameters[0]}`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleInviteLinkChange(
        Chisato: Client,
        from: string,
        participant: string,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        const caption = `「 *GROUP CHANGE* 」\n\n@${
            participant.split("@")[0]
        } has changed the group link`;

        await Chisato.sendText(from, caption, null, {
            mentions: [participant],
        });
    }

    private async handleIconChange(
        Chisato: Client,
        from: string,
        participant: string,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        try {
            const picture = await Chisato.profilePictureUrl(from, "image");
            const caption = `「 *GROUP CHANGE* 」\n\n@${
                participant.split("@")[0]
            } has changed the group icon`;

            await Chisato.sendImage(from, picture, caption, null, {
                mentions: [participant],
            });
        } catch {
            const caption = `「 *GROUP CHANGE* 」\n\n@${
                participant.split("@")[0]
            } has deleted the group icon`;

            await Chisato.sendText(from, caption, null, {
                mentions: [participant],
            });
        }
    }

    private async handleParticipantPromote(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        let caption = `「 *GROUP PARTICIPANTS* 」\n\n@${
            participant.split("@")[0]
        } has promoted`;

        for (const user of parameters) {
            const obj = JSON.parse(user);
            caption += ` @${obj.id.split("@")[0]}`;
        }

        caption += ` to admin`;

        await Chisato.sendText(from, caption, null, {
            mentions: [
                participant,
                ...parameters.map(u => JSON.parse(u).id)
            ],
        });
    }

    private async handleParticipantDemote(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        let caption = `「 *GROUP PARTICIPANTS* 」\n\n@${
            participant.split("@")[0]
        } has demoted`;

        for (const user of parameters) {
            const obj = JSON.parse(user);
            caption += ` @${obj.id.split("@")[0]}`;
        }  

        caption += ` from admin`;

        await Chisato.sendText(from, caption, null, {
            mentions: [
                participant,
                ...parameters.map(p => JSON.parse(p).id)
            ],
        });
    }

    private async handleParticipantAdd(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        groupName: string,
        isBanned: boolean,
        isWelcome: boolean
    ): Promise<void> {
        if (isBanned) {
            const caption = `「 *GROUP BANNED* 」\n\n@${
                participant.split("@")[0]
            } has been listed on the banned list in this Group`;

            await Chisato.sendText(from, caption, null, {
                mentions: [participant],
            });
        }

        if (isWelcome) {
            try {
                const groupMetadata = await Chisato.groupMetadata(from);
                const memberCount = groupMetadata.participants.length;
                const groupName = groupMetadata.subject;

                for (const user of parameters) {
                    const obj = JSON.parse(user);
                    const userNumber = obj.phoneNumber;

                    let profilePicUrl: string;
                    try {
                        profilePicUrl = await Chisato.profilePictureUrl(userNumber, "image");
                    } catch {
                        profilePicUrl = path.join(process.cwd(), "media", "noprofile.png");
                    }

                    const username = userNumber.split("@")[0];

                    const welcomeBuffer = await createWelcomeImage(
                        profilePicUrl,
                        username,
                        groupName,
                        memberCount
                    );

                    await Chisato.sendImage(
                        from,
                        welcomeBuffer,
                        `👋 Welcome to *${groupName}*!\n\n@${username}\n\nYou are member #${memberCount}`,
                        null,
                        { mentions: [userNumber] }
                    );
                }
            } catch (error) {
                logger.error(`Failed to send welcome image: ${error instanceof Error ? error.message : String(error)}`);
                
                let caption = `「 *GROUP WELCOME* 」\n\nHello`;
                for (const user of parameters) {
                    const obj = JSON.parse(user);
                    caption += ` @${obj.phoneNumber.split("@")[0]}`;
                }
                caption += ` Welcome to the ${groupName}`;

                await Chisato.sendText(from, caption, null, {
                    mentions: [
                        participant,
                        ...parameters.map(u => JSON.parse(u).id)
                    ],
                });
            }
        }
    }

    private async handleParticipantLeave(
        Chisato: Client,
        from: string,
        participant: string,
        parameters: any,
        botNumber: string,
        isLeave: boolean
    ): Promise<void> {
        const { Group } = this.Database;

        if (isLeave) {
            try {
                const groupMetadata = await Chisato.groupMetadata(from);
                const groupName = groupMetadata.subject;
                const memberCount = groupMetadata.participants.length;

                for (const user of parameters) {
                    const obj = JSON.parse(user);
                    const userNumber = obj.phoneNumber;

                    let profilePicUrl: string;
                    try {
                        profilePicUrl = await Chisato.profilePictureUrl(userNumber, "image");
                    } catch {
                        profilePicUrl = path.join(process.cwd(), "media", "noprofile.png");
                    }

                    const username = userNumber.split("@")[0];

                    const leaveBuffer = await createLeaveImage(
                        profilePicUrl,
                        username,
                        groupName,
                        memberCount
                    );

                    await Chisato.sendImage(
                        from,
                        leaveBuffer,
                        `👋 Goodbye *@${username}*!\n\nThanks for being part of *${groupName}*\n\nRemaining members: ${memberCount}`,
                        null,
                        { mentions: [userNumber] }
                    );
                }
            } catch (error) {
                logger.error(`Failed to send leave image: ${error instanceof Error ? error.message : String(error)}`);
                
                let caption = `「 *GROUP LEAVE* 」\n\nByee`;
                for (const user of parameters) {
                    const obj = JSON.parse(user);
                    caption += ` @${obj.id.split("@")[0]}`;
                }
                caption += ` Goodbye and see you again`;

                await Chisato.sendText(from, caption, null, {
                    mentions: [
                        participant,
                        ...parameters.map(u => JSON.parse(u).id)
                    ],
                });
            }
        }

        if (participant.split("@")[0] === botNumber.split("@")[0]) {
            await Group.delete(from);
        } else {
            await this.updateGroupMetadata(Chisato, from);
        }
    }

    private async updateGroupMetadata(
        Chisato: Client,
        from: string
    ): Promise<void> {
        try {
            const metadata = await Chisato.groupMetadata(from);
            if (metadata) {
                await this.Database.Group.update(from, {
                    size: metadata?.size || metadata?.participants?.length || 0,
                    participants: metadata.participants,
                });
                logger.info(`Group metadata for ${from} updated successfully.`);
            }
        } catch (error) {
            logger.error(
                `Failed to update group metadata: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private extractId = (entry: any): string | null => {
        if (!entry) return null;

        if (typeof entry === "string") {
            try {
                const parsed = JSON.parse(entry);
                if (parsed && parsed.id) return parsed.id;
            } catch (e) {
                return entry;
            }
        }

        if (typeof entry === "object") {
            if (entry.id) return entry.id;
            if (entry.phoneNumber) return entry.phoneNumber;
        }

        return null;
    };
}
