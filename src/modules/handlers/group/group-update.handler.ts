import { GroupSerialize } from "../../../types/structure/serialize";
import { Group as GroupDatabase } from "../../../libs/database";
import { Client } from "../../../libs";
import { logger } from "../../../core/logger";
import { createWelcomeImage, createLeaveImage } from "../../../utils/converter";
import { resolveToPnJid } from "../../../utils/jid-resolver";
import path from "path";
import util from "util";

// Cache baileys proto — avoids redundant dynamic import on every event
let cachedProto: any = null;
async function getProto() {
    if (cachedProto) return cachedProto;
    const dynamicImport = new Function("specifier", "return import(specifier)");
    const baileys = await dynamicImport("baileys");
    cachedProto = baileys.proto;
    return cachedProto;
}

type ParticipantsUpdate = {
    id: string;
    author?: string;
    authorPn?: string;
    authorUsername?: string;
    participants: Array<
        string | { id?: string; phoneNumber?: string; admin?: string | null }
    >;
    action: "add" | "remove" | "promote" | "demote" | "modify";
};

/**
 * Prefers phoneNumber (@s.whatsapp.net) over lid.
 */
function extractJid(entry: ParticipantsUpdate["participants"][number]): string | null {
    if (typeof entry === "string") return entry;
    if (!entry) return null;
    return entry.phoneNumber || entry.id || null;
}

/**
 * Race a promise against a timeout. Returns null if it doesn't finish in time.
 */
async function withTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T | null> {
    return Promise.race<T | null>([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]).catch(() => null);
}

const PROFILE_PIC_TIMEOUT_MS = 800;
const PROFILE_PIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_PROFILE_PIC = path.join(process.cwd(), "media", "noprofile.png");

const MAX_EVENT_MEDIA = 3;
const EVENT_SEND_GAP_MS = 1500;
const STARTUP_GRACE_MS = 25_000;
const EVENT_SETTLE_MIN_MS = 1200;
const EVENT_SETTLE_JITTER_MS = 1500;
const EVENT_MEDIA_WINDOW_MS = 60_000;
const EVENT_MEDIA_MAX_PER_WINDOW = 6;
let eventMediaTimestamps: number[] = [];

/** Returns true (and records the send) if an event-media upload is allowed now. */
function allowEventMedia(): boolean {
    const now = Date.now();
    eventMediaTimestamps = eventMediaTimestamps.filter(
        (t) => now - t < EVENT_MEDIA_WINDOW_MS
    );
    if (eventMediaTimestamps.length >= EVENT_MEDIA_MAX_PER_WINDOW) return false;
    eventMediaTimestamps.push(now);
    return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settleDelay = () =>
    sleep(EVENT_SETTLE_MIN_MS + Math.floor(Math.random() * EVENT_SETTLE_JITTER_MS));

function isWithinStartupGrace(Chisato: Client): boolean {
    const readyAt = (Chisato as any).readyAt || 0;
    return readyAt === 0 || Date.now() - readyAt < STARTUP_GRACE_MS;
}

function isSocketReady(Chisato: Client): boolean {
    const ws: any = (Chisato as any).ws;
    if (ws && typeof ws.isOpen === "boolean") return ws.isOpen;
    const rs = ws?.readyState ?? ws?.socket?.readyState;
    return rs === undefined || rs === 1; // 1 = OPEN; unknown → assume ok
}

/** user-part (e.g. "628xxxx" or "12345" for LID) → resolved URL/path. */
const profilePicCache = new Map<string, { url: string; expiresAt: number }>();

function jidUserPart(jid: string): string {
    const [user] = jid.split("@");
    return user?.split(":")[0] ?? "";
}

/**
 * Resolve a profile picture URL for a group participant.
 */
async function resolveProfilePic(
    Chisato: Client,
    userJid: string,
    groupMetadata: any
): Promise<string> {
    const userPart = jidUserPart(userJid);

    if (userPart) {
        const cached = profilePicCache.get(userPart);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.url;
        }
    }

    if (groupMetadata?.participants?.length) {
        for (const p of groupMetadata.participants) {
            const candidates = [p.id, p.lid, p.phoneNumber].filter(Boolean) as string[];
            if (!candidates.some((c) => jidUserPart(c) === userPart)) continue;
            const imgUrl = (p as any).imgUrl;
            if (imgUrl && imgUrl !== "changed") {
                if (userPart) {
                    profilePicCache.set(userPart, {
                        url: imgUrl,
                        expiresAt: Date.now() + PROFILE_PIC_CACHE_TTL_MS,
                    });
                }
                return imgUrl;
            }
            break;
        }
    }

    // 3. Remote lookup with a tight timeout.
    const url = await withTimeout(
        Chisato.profilePictureUrl(userJid, "image"),
        PROFILE_PIC_TIMEOUT_MS
    );

    const resolved = url || DEFAULT_PROFILE_PIC;
    if (userPart) {
        profilePicCache.set(userPart, {
            url: resolved,
            expiresAt: Date.now() + PROFILE_PIC_CACHE_TTL_MS,
        });
    }
    return resolved;
}

export class GroupUpdateHandler {
    private Database = {
        Group: new GroupDatabase(),
    };

    /**
     * Resolve the user-part of every JID identifier we know for the bot
     * (PN-form `id` and LID-form `lid`). A participant entry is considered
     * "the bot" if any of its identifiers (`id`, `phoneNumber`, `lid`) shares
     * a user-part with one of these.
     */
    private async getBotIdentifiers(Chisato: Client): Promise<Set<string>> {
        const out = new Set<string>();
        const push = (jid: string | null | undefined) => {
            if (!jid) return;
            const user = jid.split("@")[0]?.split(":")[0];
            if (user) out.add(user);
        };

        push(await Chisato.decodeJid(Chisato.user?.id));
        push(((Chisato.user as any)?.lid ?? "") as string);
        return out;
    }

    /**
     * Does any identifier in this participant entry belong to the bot?
     */
    private entryBelongsToBot(
        entry: ParticipantsUpdate["participants"][number],
        botUserParts: Set<string>
    ): boolean {
        if (botUserParts.size === 0) return false;

        const candidates: Array<string | undefined | null> =
            typeof entry === "string"
                ? [entry]
                : entry
                ? [
                      entry.id,
                      (entry as any).phoneNumber,
                      (entry as any).lid,
                  ]
                : [];

        for (const c of candidates) {
            if (typeof c !== "string" || !c) continue;
            const user = c.split("@")[0]?.split(":")[0];
            if (user && botUserParts.has(user)) return true;
        }
        return false;
    }

    /**
     * Robustly decide whether the bot itself is among a set of participants.
     *
     * The fast path compares raw identity forms (id/phoneNumber/lid) against
     * the bot's known identifiers. Because a kick event can deliver the bot's
     * participant as an *unmapped* LID — in which case the fast path misses and
     * the bot would otherwise try to send a leave image to a group it's no
     * longer in (a top ban trigger) — we also resolve each JID to its PN and
     * compare against the bot's number.
     */
    private async listIncludesBot(
        Chisato: Client,
        participants: ParticipantsUpdate["participants"],
        botUserParts: Set<string>,
        botPn: string
    ): Promise<boolean> {
        if (participants.some((p) => this.entryBelongsToBot(p, botUserParts))) {
            return true;
        }
        for (const p of participants) {
            const jid = extractJid(p);
            if (!jid) continue;
            try {
                const pn = (await resolveToPnJid(Chisato, jid))
                    .split("@")[0]
                    ?.split(":")[0];
                if (pn && (pn === botPn || botUserParts.has(pn))) return true;
            } catch {
                /* resolution failure → fall through */
            }
        }
        return false;
    }

    /** Drop any entry that belongs to the bot from a recipient JID list. */
    private filterOutBot(
        participants: string[],
        botUserParts: Set<string>,
        botPn: string
    ): string[] {
        return participants.filter((jid) => {
            const user = jid.split("@")[0]?.split(":")[0];
            return !!user && user !== botPn && !botUserParts.has(user);
        });
    }

    async handleParticipantsUpdate(
        Chisato: Client,
        update: ParticipantsUpdate
    ): Promise<void> {
        try {
            const { id: from, action, author } = update;
            if (!from || !update.participants?.length) return;
            const participantJids = update.participants
                .map(extractJid)
                .filter((j): j is string => !!j);

            if (!participantJids.length) return;

            logger.info(
                `[participants.update] ${action} in ${from}: ${participantJids.join(", ")}`
            );

            const { Group } = this.Database;
            const botUserParts = await this.getBotIdentifiers(Chisato);
            const botNumber = await Chisato.decodeJid(Chisato.user.id);
            const botPn = botNumber.split("@")[0]?.split(":")[0] || "";
            const actor = author ? await Chisato.decodeJid(author) : botNumber;

            // Bot was removed/left → drop the group from DB immediately,
            // BEFORE attempting to fetch metadata (which would fail since the
            // bot no longer has access). Without this early branch, the
            // upsert below throws and the handler `return`s without cleanup,
            // leaving an orphaned row for `syncdatabase` to clean up later.
            // Detection is robust (resolves LIDs to PN) so the bot never tries
            // to send a leave image to a group that just kicked it.
            const botLeft =
                action === "remove" &&
                (await this.listIncludesBot(
                    Chisato,
                    update.participants,
                    botUserParts,
                    botPn
                ));
            if (botLeft) {
                logger.info(
                    `[participants.update] bot was removed from ${from} — cleaning up DB`
                );
                try {
                    await Group.delete(from);
                } catch (err) {
                    logger.error(
                        `Failed to delete group ${from} after bot removal: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    );
                }
                return;
            }

            // Fetch group metadata + settings in parallel
            let [groupMetadata, groupSettings] = await Promise.all([
                Group.get(from),
                Group.getSettings(from).catch(() => null),
            ]);

            if (!groupMetadata) {
                try {
                    groupMetadata = await Group.upsert(Chisato, from);
                } catch (err) {
                    logger.error(
                        `handleParticipantsUpdate: Failed to upsert group metadata: ${
                            err instanceof Error ? err.message : String(err)
                        }`
                    );
                    return;
                }
            }
            if (!groupMetadata?.subject) return;

            if (!groupSettings) {
                groupSettings = groupMetadata.settings;
            }

            const isBotAdmin = groupMetadata.participants
                ?.filter((v: any) => v.admin !== null)
                .map((v: any) => v.id)
                .includes(botNumber);

            const isNotify = groupSettings?.notify;
            const isWelcome = groupSettings?.welcome;
            const isLeave = groupSettings?.leave;
            const isBanned = participantJids.some((jid) =>
                groupSettings?.banned?.includes(jid)
            );

            // Recipients for welcome/leave notices, with the bot itself removed
            // (defense-in-depth: never render/send a notice whose subject is
            // the bot — e.g. when the bot is part of a remove/add event).
            const recipients = this.filterOutBot(participantJids, botUserParts, botPn);

            switch (action) {
                case "add":
                    await this.handleAntiBotKick(
                        Chisato,
                        from,
                        participantJids,
                        groupSettings?.antibot ?? false,
                        isBotAdmin
                    );
                    if (recipients.length) {
                        await this.handleParticipantAdd(
                            Chisato,
                            from,
                            recipients,
                            groupMetadata,
                            groupSettings,
                            isBanned,
                            isWelcome
                        );
                    }
                    await this.updateGroupMetadata(Chisato, from);
                    break;

                case "remove":
                    if (recipients.length) {
                        await this.handleParticipantLeave(
                            Chisato,
                            from,
                            recipients,
                            botNumber,
                            groupMetadata,
                            groupSettings,
                            isLeave
                        );
                    } else {
                        // Nothing to notify (e.g. only the bot was in the event).
                        await this.updateGroupMetadata(Chisato, from);
                    }
                    break;

                case "promote":
                    await this.handleParticipantPromote(
                        Chisato,
                        from,
                        actor,
                        participantJids,
                        isNotify
                    );
                    await this.updateGroupMetadata(Chisato, from);
                    break;

                case "demote":
                    await this.handleParticipantDemote(
                        Chisato,
                        from,
                        actor,
                        participantJids,
                        isNotify
                    );
                    await this.updateGroupMetadata(Chisato, from);
                    break;
            }
        } catch (error) {
            logger.error(
                `Participants update handler error: ${
                    error instanceof Error ? util.inspect(error) : String(error)
                }`
            );
        }
    }

    async handle(Chisato: Client, message: GroupSerialize): Promise<void> {
        try {
            const proto = await getProto();

            const { parameters, from, participant, type, expiration } = message;

            if (!from || !participant) return;

            const { Group } = this.Database;

            let groupMetadata = await Group.get(from);
            if (!groupMetadata) {
                try {
                    groupMetadata = await Group.upsert(Chisato, from);
                } catch (upsertError) {
                    logger.error(
                        `Group update: Failed to upsert group metadata: ${
                            upsertError instanceof Error
                                ? upsertError.message
                                : String(upsertError)
                        }`
                    );
                }
            }

            if (!groupMetadata || !groupMetadata.subject) {
                return;
            }

            const GroupSetting = await Group.getSettings(from).catch(
                () => groupMetadata?.settings
            );

            const isNotify = GroupSetting?.notify;

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

                // GROUP_PARTICIPANT_ADD/INVITE/LEAVE/REMOVE/PROMOTE/DEMOTE are
                // handled via the real-time `group-participants.update` event
                // for faster response (see handleParticipantsUpdate).
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
        actor: string,
        participants: string[],
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        let caption = `「 *GROUP PARTICIPANTS* 」\n\n@${
            actor.split("@")[0]
        } has promoted`;

        for (const jid of participants) {
            caption += ` @${jid.split("@")[0]}`;
        }

        caption += ` to admin`;

        await Chisato.sendText(from, caption, null, {
            mentions: [actor, ...participants],
        });
    }

    private async handleParticipantDemote(
        Chisato: Client,
        from: string,
        actor: string,
        participants: string[],
        isNotify: boolean
    ): Promise<void> {
        if (!isNotify) return;

        let caption = `「 *GROUP PARTICIPANTS* 」\n\n@${
            actor.split("@")[0]
        } has demoted`;

        for (const jid of participants) {
            caption += ` @${jid.split("@")[0]}`;
        }

        caption += ` from admin`;

        await Chisato.sendText(from, caption, null, {
            mentions: [actor, ...participants],
        });
    }

    private async handleParticipantAdd(
        Chisato: Client,
        from: string,
        participants: string[],
        groupMetadata: any,
        groupSettings: any,
        isBanned: boolean,
        isWelcome: boolean
    ): Promise<void> {
        if (isBanned) {
            const banned = participants.filter((jid) =>
                groupSettings?.banned?.includes(jid)
            );
            if (banned.length) {
                const caption = banned
                    .map(
                        (jid) =>
                            `「 *GROUP BANNED* 」\n\n@${
                                jid.split("@")[0]
                            } has been listed on the banned list in this Group`
                    )
                    .join("\n\n");
                await Chisato.sendText(from, caption, null, {
                    mentions: banned,
                });
            }
        }

        if (!isWelcome) return;

        if (!isSocketReady(Chisato)) {
            logger.warn(
                `Skipping welcome for ${from}: socket not ready (avoiding flood into a closing connection).`
            );
            return;
        }

        // Suppress greetings for the reconnect backlog (see STARTUP_GRACE_MS).
        if (isWithinStartupGrace(Chisato)) {
            logger.warn(
                `Skipping welcome for ${from}: within startup grace window (backlog event).`
            );
            return;
        }

        const memberCount = groupMetadata.participants?.length ?? 0;
        const groupName = groupMetadata.subject;
        const groupOwner = groupMetadata.owner || "";
        const customMessage = groupSettings?.welcomeMessage;

        // Let the membership change settle; don't react in the same instant.
        await settleDelay();
        if (!isSocketReady(Chisato)) return;

        if (participants.length > MAX_EVENT_MEDIA) {
            const mentions = [...participants];
            const names = participants
                .map((u) => `@${u.split("@")[0]}`)
                .join(", ");
            const caption =
                `👋 Welcome to *${groupName}*!\n\n${names}\n\n` +
                `You're now part of the group — enjoy! (${memberCount} members)`;
            try {
                await Chisato.sendText(from, caption, null, { mentions });
            } catch (error) {
                logger.error(
                    `Failed to send combined welcome for ${from}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
            return;
        }

        for (let i = 0; i < participants.length; i++) {
            const userNumber = participants[i];
            if (i > 0) await sleep(EVENT_SEND_GAP_MS);
            if (!isSocketReady(Chisato)) return;
            try {
                const profilePicUrl = await resolveProfilePic(
                    Chisato,
                    userNumber,
                    groupMetadata
                );

                const username = userNumber.split("@")[0];

                let caption: string;
                const mentions: string[] = [userNumber];

                if (customMessage) {
                    caption = customMessage
                        .replace(/@user/g, `@${username}`)
                        .replace(/@group/g, groupName)
                        .replace(
                            /@ownergroup/g,
                            groupOwner
                                ? `@${groupOwner.split("@")[0]}`
                                : "Admin"
                        );

                    if (customMessage.includes("@ownergroup") && groupOwner) {
                        mentions.push(groupOwner);
                    }

                    const phoneRegex = /@(\d+)/g;
                    let match;
                    while ((match = phoneRegex.exec(customMessage)) !== null) {
                        const phoneNumber = match[1] + "@s.whatsapp.net";
                        if (!mentions.includes(phoneNumber)) {
                            mentions.push(phoneNumber);
                        }
                    }
                } else {
                    caption = `👋 Welcome to *${groupName}*!\n\n@${username}\n\nYou are member #${memberCount}`;
                }

                if (!isSocketReady(Chisato)) return;
                if (allowEventMedia()) {
                    const welcomeBuffer = await createWelcomeImage(
                        profilePicUrl,
                        username,
                        groupName,
                        memberCount,
                        groupSettings?.welcomeConfig
                    );
                    await Chisato.sendImage(from, welcomeBuffer, caption, null, {
                        mentions,
                    });
                } else {
                    // Over the media budget — degrade to text to stay under
                    // WhatsApp's anti-flood radar.
                    await Chisato.sendText(from, caption, null, { mentions });
                }
            } catch (error) {
                logger.error(
                    `Failed to send welcome image for ${userNumber}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );

                const username = userNumber.split("@")[0];
                await Chisato.sendText(
                    from,
                    `「 *GROUP WELCOME* 」\n\nHello @${username} — welcome to the ${groupName}`,
                    null,
                    { mentions: [userNumber] }
                ).catch(() => {});
            }
        }
    }

    private async handleParticipantLeave(
        Chisato: Client,
        from: string,
        participants: string[],
        botNumber: string,
        groupMetadata: any,
        groupSettings: any,
        isLeave: boolean
    ): Promise<void> {
        if (isLeave && isSocketReady(Chisato) && !isWithinStartupGrace(Chisato)) {
            const groupName = groupMetadata.subject;
            const memberCount = groupMetadata.participants?.length ?? 0;
            const groupOwner = groupMetadata.owner || "";
            const customMessage = groupSettings?.leaveMessage;

            // Let the membership change settle; don't react in the same instant.
            await settleDelay();
            if (!isSocketReady(Chisato)) {
                await this.updateGroupMetadata(Chisato, from);
                return;
            }

            if (participants.length > MAX_EVENT_MEDIA) {
                const mentions = [...participants];
                const names = participants
                    .map((u) => `@${u.split("@")[0]}`)
                    .join(", ");
                await Chisato.sendText(
                    from,
                    `👋 ${names} left *${groupName}*. Remaining members: ${memberCount}`,
                    null,
                    { mentions }
                ).catch((error) =>
                    logger.error(
                        `Failed to send combined leave for ${from}: ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    )
                );
                await this.updateGroupMetadata(Chisato, from);
                return;
            }

            for (let i = 0; i < participants.length; i++) {
                const userNumber = participants[i];
                if (i > 0) await sleep(EVENT_SEND_GAP_MS);
                if (!isSocketReady(Chisato)) break;
                try {
                    const profilePicUrl = await resolveProfilePic(
                        Chisato,
                        userNumber,
                        groupMetadata
                    );

                    const username = userNumber.split("@")[0];

                    let caption: string;
                    const mentions: string[] = [userNumber];

                    if (customMessage) {
                        caption = customMessage
                            .replace(/@user/g, `@${username}`)
                            .replace(/@group/g, groupName)
                            .replace(
                                /@ownergroup/g,
                                groupOwner
                                    ? `@${groupOwner.split("@")[0]}`
                                    : "Admin"
                            );

                        if (
                            customMessage.includes("@ownergroup") &&
                            groupOwner
                        ) {
                            mentions.push(groupOwner);
                        }

                        const phoneRegex = /@(\d+)/g;
                        let match;
                        while (
                            (match = phoneRegex.exec(customMessage)) !== null
                        ) {
                            const phoneNumber = match[1] + "@s.whatsapp.net";
                            if (!mentions.includes(phoneNumber)) {
                                mentions.push(phoneNumber);
                            }
                        }
                    } else {
                        caption = `👋 Goodbye *@${username}*!\n\nThanks for being part of *${groupName}*\n\nRemaining members: ${memberCount}`;
                    }

                    if (!isSocketReady(Chisato)) break;
                    if (allowEventMedia()) {
                        const leaveBuffer = await createLeaveImage(
                            profilePicUrl,
                            username,
                            groupName,
                            memberCount,
                            groupSettings?.leaveConfig
                        );
                        await Chisato.sendImage(from, leaveBuffer, caption, null, {
                            mentions,
                        });
                    } else {
                        // Over the media budget — degrade to text.
                        await Chisato.sendText(from, caption, null, { mentions });
                    }
                } catch (error) {
                    logger.error(
                        `Failed to send leave image for ${userNumber}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );

                    const username = userNumber.split("@")[0];
                    await Chisato.sendText(
                        from,
                        `「 *GROUP LEAVE* 」\n\nByee @${username} — goodbye and see you again`,
                        null,
                        { mentions: [userNumber] }
                    ).catch(() => {});
                }
            }
        }

        await this.updateGroupMetadata(Chisato, from);
    }

    /**
     * Detects whether a JID belongs to a bot account.
     */
    private isBotJid(jid: string): boolean {
        const number = jid.split("@")[0];
        if (number.includes(":")) return true;
        if (number.startsWith("0")) return true;
        if (number.length < 7) return true;
        return false;
    }

    /**
     * Anti-bot handler: kick accounts that look like bots upon joining.
     */
    private async handleAntiBotKick(
        Chisato: Client,
        from: string,
        participants: string[],
        isAntibot: boolean,
        isBotAdmin: boolean
    ): Promise<void> {
        if (!isAntibot || !isBotAdmin) return;

        const toBoot = participants.filter((jid) => this.isBotJid(jid));

        for (const botJid of toBoot) {
            try {
                await Chisato.groupParticipantsUpdate(from, [botJid], "remove");

                const caption =
                    `*「 ANTI-BOT 」*\n\n` +
                    `🤖 Bot account @${
                        botJid.split("@")[0]
                    } has been automatically kicked.\n\n` +
                    `_Anti-bot is enabled in this group._`;

                await Chisato.sendText(from, caption, null, {
                    mentions: [botJid],
                });

                logger.info(`Anti-bot: kicked ${botJid} from ${from}`);
            } catch (err) {
                logger.error(
                    `Anti-bot: failed to kick ${botJid} — ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }
        }
    }

    private async updateGroupMetadata(
        Chisato: Client,
        from: string
    ): Promise<void> {
        // Skip the metadata fetch when the socket is closing — hammering
        // groupMetadata on a dead connection just produces "Connection Closed"
        // errors and can pile onto an in-progress disconnect.
        if (!isSocketReady(Chisato)) return;
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
}
