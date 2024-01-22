import { proto } from "baileys";
import { Chisato } from "../types/client";
import { GroupSerialize } from "../types/serialize";
import { Group as GroupDatabase, GroupSetting as GroupSettingDatabase } from "../libs/database";

export const groupUpdate = async (Chisato: Chisato, message: GroupSerialize) => {
    const { parameters, key, from, timestamp, participant, type, message: msg, expiration } = message;
    let caption: string;

    const Group = new GroupDatabase();
    const GroupSetting = new GroupSettingDatabase();
    const botNumber = Chisato.decodeJid(Chisato.user.id);
    const groupMetadata = (await Group.get(from)) ?? (await Group.upsert(Chisato, from));
    const groupName = groupMetadata.subject;

    /** Validate */
    const isBotAdmin = groupMetadata.participants
        ?.filter((v) => v.admin !== null)
        .map((v) => v.id)
        .includes(botNumber);
    const isNotify = (await GroupSetting.get(from))?.notify ?? (await GroupSetting.upsert(Chisato, from))?.notify;
    const isWelcome = (await GroupSetting.upsert(Chisato, from))?.welcome;
    const isLeave = (await GroupSetting.upsert(Chisato, from))?.leave;
    const isBanned = (await GroupSetting.get(from))?.banned?.includes(participant);

    /** Get Group Participants */
    const getMetadata = async (gid: string) => {
        try {
            const metadata = await Chisato.groupMetadata(gid);
            return metadata;
        } catch {
            await getMetadata(gid);
        }
    };

    switch (type) {
        /** Sending Permission Notifications Sending Group Messages */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_ANNOUNCE:
            if (isNotify) {
                if (parameters[0] === "on") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has restricted members from sending messages`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                } else if (parameters[0] === "off") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has opened restrictions on members sending messages`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                }
            }
            await Group.update(from, { announce: parameters[0] === "on" ? false : true });
            break;
        /** Sending Group Editing Permission Notifications */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_RESTRICT:
            if (isNotify) {
                if (parameters[0] === "on") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has restricted members from editing the group`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                } else if (parameters[0] === "off") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has opened members restrictions to edit group`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                }
            }
            await Group.update(from, { restrict: parameters[0] === "on" ? false : true });
            break;
        /** Sending Notification of Changing Approve New Members Setting */
        case proto.WebMessageInfo.StubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
            if (isNotify) {
                if (parameters[0] === "on") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has enabled the Approval Mode for joining the group`;
                } else {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${participant.split("@")[0]} has disabled the Approval Mode for joining the group`;
                }
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            await Group.update(from, { approval: parameters[0] === "on" ? true : false });
            break;
        /** Sending Notification of Changing Add Other Members Setting */
        case proto.WebMessageInfo.StubType.GROUP_MEMBER_ADD_MODE:
            if (isNotify) {
                if (parameters[0] === "on") {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${
                            participant.split("@")[0]
                        } has disabled the Add other members setting. Now only Admin can invite Other Members`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                } else {
                    caption =
                        `「 *GROUP CHANGE* 」\n\n` +
                        `@${
                            participant.split("@")[0]
                        } has enabled the Add other members setting. Now all members can invite Other Members`;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                }
            }
            await Group.update(from, { memberAddMode: parameters[0] === "on" ? false : true });
            break;
        /** Sending Disappearing Message Notifications */
        case proto.WebMessageInfo.StubType.CHANGE_EPHEMERAL_SETTING:
            if (isNotify) {
                switch (expiration) {
                    case 86400:
                        caption =
                            `「 *GROUP CHANGE* 」\n\n` +
                            `@${participant.split("@")[0]} has enabled disappearing messages for 24 hours`;
                        break;
                    case 604800:
                        caption =
                            `「 *GROUP CHANGE* 」\n\n` +
                            `@${participant.split("@")[0]} has enabled disappearing messages for 7 days`;
                        break;
                    case 7776000:
                        caption =
                            `「 *GROUP CHANGE* 」\n\n` +
                            `@${participant.split("@")[0]} has enabled disappearing messages for 90 days`;
                        break;
                    case 0:
                        caption =
                            `「 *GROUP CHANGE* 」\n\n` +
                            `@${participant.split("@")[0]} has disabled disappearing messages`;
                        break;
                }
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            await Group.update(from, { ephemeralDuration: expiration });
            break;
        /** Sending Notification of Changing Group Name */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_SUBJECT:
            if (isNotify) {
                caption =
                    `「 *GROUP CHANGE* 」\n\n` +
                    `@${participant.split("@")[0]} has changed the group name to *${parameters[0]}*`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            await Group.update(from, { subject: parameters[0] });
            break;
        /** Sending Notification of Changing Group Description */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_DESCRIPTION:
            if (isNotify) {
                caption =
                    `「 *GROUP CHANGE* 」\n\n` +
                    `@${participant.split("@")[0]} has changed the group description to \n\n${parameters[0]}`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            await Group.update(from, { desc: parameters[0] });
            break;
        /** Sending Notification of Changing Group Invite Link */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_INVITE_LINK:
            if (isNotify) {
                caption = `「 *GROUP CHANGE* 」\n\n` + `@${participant.split("@")[0]} has changed the group link`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            break;
        /** Sending Notification of Changing Group Icon */
        case proto.WebMessageInfo.StubType.GROUP_CHANGE_ICON:
            if (isNotify) {
                let picture: string;
                try {
                    caption = `「 *GROUP CHANGE* 」\n\n` + `@${participant.split("@")[0]} has changed the group icon`;
                    picture = await Chisato.profilePictureUrl(from, "image");
                    await Chisato.sendImage(from, picture, caption, null, {
                        mentions: [participant],
                    });
                } catch {
                    caption = `「 *GROUP CHANGE* 」\n\n` + `@${participant.split("@")[0]} has deleted the group icon`;
                    picture = null;
                    await Chisato.sendText(from, caption, null, {
                        mentions: [participant],
                    });
                }
            }
            break;
        /** Sending Notifications Promoting Group Members */
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_PROMOTE:
            if (isNotify) {
                caption = `「 *GROUP PARTICIPANTS* 」\n\n` + `@${participant.split("@")[0]} has promoted`;
                for (let user of parameters) {
                    caption += ` @${user.split("@")[0]}`;
                }
                caption += ` to admin`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant, ...parameters],
                });
            }
            getMetadata(from).then(async (res) => {
                await Group.update(from, {
                    size: res?.size || res?.participants?.length || 0,
                    participants: res.participants,
                });
            });
            break;
        /** Sending Notifications Demoting Group Members */
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_DEMOTE:
            if (isNotify) {
                caption = `「 *GROUP PARTICIPANTS* 」\n\n` + `@${participant.split("@")[0]} has demoted`;
                for (let user of parameters) {
                    caption += ` @${user.split("@")[0]}`;
                }
                caption += ` from admin`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant, ...parameters],
                });
            }
            getMetadata(from).then(async (res) => {
                await Group.update(from, {
                    size: res?.size || res?.participants?.length || 0,
                    participants: res.participants,
                });
            });
            break;
        /** Sending Notifications Adding & Inviting Group Members */
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_ADD:
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_INVITE:
            if (isBanned) {
                caption =
                    `「 *GROUP BANNED* 」\n\n` +
                    `@${participant.split("@")[0]} has been listed on the banned list in this Group`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant],
                });
            }
            if (isWelcome) {
                caption = `「 *GROUP WELCOME* 」\n\n` + `Hello`;
                for (let user of parameters) {
                    caption += ` @${user.split("@")[0]}`;
                }
                caption += ` Welcome to the ${groupName}`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant, ...parameters],
                });
            }
            getMetadata(from).then(async (res) => {
                await Group.update(from, {
                    size: res?.size || res?.participants?.length || 0,
                    participants: res.participants,
                });
            });
            break;
        /** Sending Notifications Leaving or Removing Group Members */
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_LEAVE:
        case proto.WebMessageInfo.StubType.GROUP_PARTICIPANT_REMOVE:
            if (isLeave) {
                caption = `「 *GROUP LEAVE* 」\n\n` + `Byee`;
                for (let user of parameters) {
                    caption += ` @${user.split("@")[0]}`;
                }
                caption += ` Goodbye and see you again`;
                await Chisato.sendText(from, caption, null, {
                    mentions: [participant, ...parameters],
                });
            }
            if (participant === botNumber) return await Group.delete(from);
            getMetadata(from).then(async (res) => {
                await Group.update(from, {
                    size: res?.size || res?.participants?.length || 0,
                    participants: res.participants,
                });
            });
            break;
    }
};
