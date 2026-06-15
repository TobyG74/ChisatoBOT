import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fs from "fs";
import path from "path";
import { Database } from "../../infrastructure/database";
import { getClientInstance } from "../../libs/client/instance";
import { logger } from "../../core/logger";
import {
    verifyGroupAdminAccess,
    findAdminGroupsFromDb,
    resolveMemberJid,
    mapParticipants,
    getBotPhoneNumber,
    checkAdminInMeta,
    type GroupAccessResult,
} from "../services/group-access.service";
import { logGroupAction, getGroupLogs } from "../services/group-audit.service";
import {
    resolveLayoutConfig,
    renderLayoutPreview,
    invalidateBackgroundCache,
    type LayoutVariant,
} from "../../utils/converter/welcome";

const UPLOAD_BODY_LIMIT = 8 * 1024 * 1024; // 8 MB — group photos / backgrounds
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "welcome");

type GroupAdminToken = { sessionId: string; phoneNumber: string; role: string };

function getAdmin(request: FastifyRequest): GroupAdminToken {
    return (request as any).admin as GroupAdminToken;
}

const onOff = (v: boolean): string => (v ? "enabled ✅" : "disabled ❌");

/**
 * Announce a group-admin change back to the group itself, so other members can
 * see who changed what (e.g. "admin X enabled Anti-Link"). Best-effort and
 * mentions the acting admin. Low-frequency, text-only — safe for anti-flood.
 */
async function notifyGroupChange(
    groupId: string,
    adminPn: string,
    lines: string[]
): Promise<void> {
    if (!lines.length) return;
    const client = getClientInstance();
    if (!client) return;
    const body =
        `🔧 *Group Setting Updated*\n\n` +
        `@${adminPn} changed:\n` +
        lines.map((l) => `• ${l}`).join("\n");
    try {
        await (client as any).sendText(groupId, body, null, {
            mentions: [`${adminPn}@s.whatsapp.net`],
        });
    } catch (err) {
        logger.warn(
            `Failed to notify group ${groupId} of change: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
}

/** Announce a promote/demote back to the group, mentioning actor + target. */
async function notifyGroupMemberAction(
    groupId: string,
    actorPn: string,
    targetPn: string,
    op: "promote" | "demote"
): Promise<void> {
    const client = getClientInstance();
    if (!client) return;
    const body =
        op === "promote"
            ? `⬆️ @${actorPn} promoted @${targetPn} to *admin*.`
            : `⬇️ @${actorPn} removed @${targetPn} from *admin*.`;
    try {
        await (client as any).sendText(groupId, body, null, {
            mentions: [`${actorPn}@s.whatsapp.net`, `${targetPn}@s.whatsapp.net`],
        });
    } catch (err) {
        logger.warn(
            `Failed to notify group ${groupId} of member action: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
}

/**
 * Resolve `request.admin` + verify live access to `groupId`. On failure it
 * sends the reply and returns null, so callers just `if (!access) return;`.
 */
async function requireAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    groupId: string,
    requireBotAdmin = true
): Promise<GroupAccessResult | null> {
    const admin = getAdmin(request);
    if (!admin?.phoneNumber) {
        reply.status(401).send({ success: false, message: "Unauthorized" });
        return null;
    }
    const client = getClientInstance();
    const access = await verifyGroupAdminAccess(
        client,
        groupId,
        admin.phoneNumber,
        requireBotAdmin
    );
    if (!access.ok) {
        reply.status(403).send({ success: false, message: access.reason });
        return null;
    }
    return access;
}

/** Decode a `data:` URL or bare base64 string into a Buffer. */
function decodeBase64Image(input: string): Buffer | null {
    if (!input || typeof input !== "string") return null;
    const comma = input.indexOf(",");
    const b64 = input.startsWith("data:") && comma !== -1 ? input.slice(comma + 1) : input;
    try {
        const buf = Buffer.from(b64, "base64");
        return buf.length ? buf : null;
    } catch {
        return null;
    }
}

export async function groupAdminRoutes(fastify: FastifyInstance) {
    // ---- Groups list -------------------------------------------------------
    fastify.get("/my-groups", async (request, reply) => {
        const admin = getAdmin(request);
        const client = getClientInstance();
        try {
            const groups = await findAdminGroupsFromDb(admin.phoneNumber, client);
            return reply.send({
                success: true,
                phoneNumber: admin.phoneNumber,
                botConnected: !!client,
                groups,
            });
        } catch (err) {
            logger.error("group-admin my-groups error:", err);
            return reply.status(500).send({ success: false, message: "Failed to load groups" });
        }
    });

    // ---- Add the bot to a new group via invite link ------------------------
    // A group admin can invite the bot into a group they administer by pasting
    // the WhatsApp invite link. We verify (from the invite's own participant
    // list) that the requester is an admin there before the bot joins, so a
    // verified number can't push the bot into arbitrary groups.
    fastify.post("/join-group", async (request, reply) => {
        const admin = getAdmin(request);
        if (!admin?.phoneNumber) {
            return reply.status(401).send({ success: false, message: "Unauthorized" });
        }
        const client = getClientInstance();
        if (!client) {
            return reply.status(503).send({ success: false, message: "Bot is not connected." });
        }

        const body = request.body as { inviteLink?: string };
        const raw = String(body.inviteLink || "").trim();
        const match = raw.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
        const code = match ? match[1] : /^[0-9A-Za-z]{20,24}$/.test(raw) ? raw : null;
        if (!code) {
            return reply.status(400).send({
                success: false,
                message: "Invalid invite link. Use https://chat.whatsapp.com/xxxxx",
            });
        }

        let info: any;
        try {
            info = await (client as any).groupGetInviteInfo(code);
        } catch (err) {
            logger.error("group-admin join-group invite-info error:", err);
            return reply.status(400).send({
                success: false,
                message: "Could not read this invite. The link may be invalid, expired, or revoked.",
            });
        }
        if (!info?.id) {
            return reply.status(400).send({ success: false, message: "Could not resolve the group from this invite." });
        }

        // Already a member? Don't try to re-join.
        try {
            const meta = await (client as any).groupMetadata(info.id);
            if (meta?.id) {
                return reply.send({
                    success: true,
                    alreadyMember: true,
                    groupId: info.id,
                    subject: info.subject || meta.subject || "Unknown",
                    message: "The bot is already a member of this group.",
                });
            }
        } catch {
            /* not a member yet — the expected path */
        }

        // Authorization: requester must be an admin of the target group.
        const check = checkAdminInMeta(info, admin.phoneNumber);
        if (!check.isAdmin) {
            return reply.status(403).send({
                success: false,
                message: check.found
                    ? "You must be an admin of that group to add the bot."
                    : "Could not verify that you are an admin of that group.",
            });
        }

        try {
            const joinedId = await (client as any).groupAcceptInvite(code);
            const groupId = joinedId || info.id;
            await logGroupAction({
                groupId,
                actorPn: admin.phoneNumber,
                action: "join",
                detail: info.subject || "",
            });
            return reply.send({
                success: true,
                groupId,
                subject: info.subject || "Unknown",
                size: info.size ?? info.participants?.length ?? 0,
                message: "Bot successfully joined the group.",
            });
        } catch (err: any) {
            logger.error("group-admin join-group error:", err);
            const m = String(err?.message || "").toLowerCase();
            let message = "Failed to join the group.";
            if (m.includes("invalid")) message = "The invite link is invalid or has expired.";
            else if (m.includes("forbidden")) message = "The bot is not allowed to join this group (possibly banned).";
            else if (m.includes("gone")) message = "The invite link has been revoked or the group no longer exists.";
            else if (err?.message) message = err.message;
            return reply.status(500).send({ success: false, message });
        }
    });

    // ---- Single group detail ----------------------------------------------
    fastify.get("/groups/:groupId", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const access = await requireAccess(request, reply, groupId, false);
        if (!access) return;

        const group = await Database.group.findUnique({ where: { groupId } });
        const meta = access.meta;
        return reply.send({
            success: true,
            group: group
                ? {
                      groupId: group.groupId,
                      subject: meta?.subject ?? group.subject,
                      desc: meta?.desc ?? group.desc,
                      size: meta?.participants?.length ?? group.size,
                      announce: meta?.announce ?? group.announce,
                      restrict: meta?.restrict ?? group.restrict,
                      joinApprovalMode: group.joinApprovalMode ?? false,
                      settings: group.settings,
                  }
                : null,
            access: {
                isSuperAdmin: access.isSuperAdmin,
                botIsAdmin: access.botIsAdmin,
            },
        });
    });

    // ---- Participants ------------------------------------------------------
    fastify.get("/groups/:groupId/participants", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const access = await requireAccess(request, reply, groupId, false);
        if (!access) return;

        const botPn = getBotPhoneNumber(getClientInstance());
        const participants = mapParticipants(access.meta).map((p) => ({
            ...p,
            isBot: !!p.phoneNumber && p.phoneNumber === botPn,
        }));
        return reply.send({
            success: true,
            total: participants.length,
            participants,
        });
    });

    // ---- Update name / description (live) ----------------------------------
    fastify.put("/groups/:groupId/profile", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const body = request.body as { subject?: string; description?: string };
        const access = await requireAccess(request, reply, groupId);
        if (!access) return;

        const admin = getAdmin(request);
        const client = getClientInstance()!;
        const changes: string[] = [];

        try {
            if (typeof body.subject === "string" && body.subject.trim()) {
                const subject = body.subject.trim().slice(0, 100);
                await (client as any).groupUpdateSubject(groupId, subject);
                await Database.group.update({ where: { groupId }, data: { subject } }).catch(() => {});
                changes.push("name");
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: "rename",
                    detail: subject,
                });
            }
            if (typeof body.description === "string") {
                const description = body.description.slice(0, 2048);
                await (client as any).groupUpdateDescription(groupId, description);
                await Database.group.update({ where: { groupId }, data: { desc: description } }).catch(() => {});
                changes.push("description");
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: "desc",
                    detail: description.slice(0, 120),
                });
            }
            return reply.send({ success: true, changed: changes });
        } catch (err) {
            logger.error("group-admin profile update error:", err);
            return reply.status(500).send({ success: false, message: "Failed to update group profile" });
        }
    });

    // ---- Member actions: kick / promote / demote (live) --------------------
    fastify.post("/groups/:groupId/members/:action", async (request, reply) => {
        const { groupId, action } = request.params as { groupId: string; action: string };
        const body = request.body as { target?: string };

        const actionMap: Record<string, "remove" | "promote" | "demote"> = {
            kick: "remove",
            promote: "promote",
            demote: "demote",
        };
        const op = actionMap[action];
        if (!op) {
            return reply.status(400).send({ success: false, message: "Invalid action" });
        }

        const access = await requireAccess(request, reply, groupId);
        if (!access) return;

        const admin = getAdmin(request);
        const client = getClientInstance()!;

        const targetRaw = String(body.target || "").replace(/[^0-9]/g, "");
        if (!targetRaw) {
            return reply.status(400).send({ success: false, message: "Target member is required" });
        }

        const botPn = getBotPhoneNumber(client);
        if (targetRaw === botPn) {
            return reply.status(400).send({ success: false, message: "You can't perform this action on the bot." });
        }
        if (targetRaw === admin.phoneNumber && op === "demote") {
            return reply.status(400).send({ success: false, message: "You can't demote yourself." });
        }

        // The group owner (superadmin) can never be kicked or demoted by an
        // admin acting through the dashboard.
        const targetInfo = mapParticipants(access.meta).find((p) => p.phoneNumber === targetRaw);
        if (targetInfo?.admin === "superadmin" && (op === "remove" || op === "demote")) {
            return reply.status(403).send({
                success: false,
                message: "You can't kick or demote the group owner.",
            });
        }

        const targetJid = resolveMemberJid(access.meta, targetRaw) || `${targetRaw}@s.whatsapp.net`;

        try {
            await (client as any).groupParticipantsUpdate(groupId, [targetJid], op);
            await logGroupAction({
                groupId,
                actorPn: admin.phoneNumber,
                action: op === "remove" ? "kick" : op,
                target: targetRaw,
            });
            // Announce promotions/demotions to the group (the kicked member is
            // gone, so a kick is logged but not announced). Skip when the
            // group's `notify` setting is on — the participant-update event
            // handler already posts its own announcement, so this avoids a
            // duplicate message.
            if (op === "promote" || op === "demote") {
                let notifyOn = false;
                try {
                    const g = await Database.group.findUnique({ where: { groupId }, select: { settings: true } });
                    notifyOn = !!(g?.settings as any)?.notify;
                } catch {
                    /* default to sending */
                }
                if (!notifyOn) {
                    await notifyGroupMemberAction(groupId, admin.phoneNumber, targetRaw, op);
                }
            }
            return reply.send({ success: true, action, target: targetRaw });
        } catch (err) {
            logger.error(`group-admin member ${action} error:`, err);
            return reply.status(500).send({ success: false, message: `Failed to ${action} member` });
        }
    });

    // ---- Bot settings toggles (DB) -----------------------------------------
    fastify.put("/groups/:groupId/settings", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const body = request.body as {
            antilinkStatus?: boolean;
            antilinkMode?: "kick" | "delete";
            antibot?: boolean;
            antidelete?: boolean;
            welcome?: boolean;
            leave?: boolean;
            notify?: boolean;
            mute?: boolean;
        };
        const access = await requireAccess(request, reply, groupId, false);
        if (!access) return;
        const admin = getAdmin(request);

        const existing = await Database.group.findUnique({ where: { groupId } });
        if (!existing) {
            return reply.status(404).send({ success: false, message: "Group not found" });
        }

        const settings: any = { ...existing.settings };
        const changes: string[] = [];
        if (body.antilinkStatus !== undefined) {
            settings.antilink = { ...settings.antilink, status: body.antilinkStatus };
            changes.push(`Anti-Link ${onOff(body.antilinkStatus)}`);
        }
        if (body.antilinkMode !== undefined && (body.antilinkMode === "kick" || body.antilinkMode === "delete")) {
            settings.antilink = { ...settings.antilink, mode: body.antilinkMode };
            changes.push(`Anti-Link action → ${body.antilinkMode === "kick" ? "Kick" : "Delete message"}`);
        }
        if (body.antibot !== undefined) { settings.antibot = body.antibot; changes.push(`Anti-Bot ${onOff(body.antibot)}`); }
        if (body.antidelete !== undefined) { settings.antidelete = body.antidelete; changes.push(`Anti-Delete ${onOff(body.antidelete)}`); }
        if (body.welcome !== undefined) { settings.welcome = body.welcome; changes.push(`Welcome message ${onOff(body.welcome)}`); }
        if (body.leave !== undefined) { settings.leave = body.leave; changes.push(`Leave message ${onOff(body.leave)}`); }
        if (body.notify !== undefined) { settings.notify = body.notify; changes.push(`Admin notify ${onOff(body.notify)}`); }
        if (body.mute !== undefined) { settings.mute = body.mute; changes.push(`Mute bot ${onOff(body.mute)}`); }

        try {
            const group = await Database.group.update({ where: { groupId }, data: { settings } });
            if (changes.length) {
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: "setting",
                    detail: changes.join(", "),
                });
                await notifyGroupChange(groupId, admin.phoneNumber, changes);
            }
            return reply.send({ success: true, settings: group.settings });
        } catch (err) {
            logger.error("group-admin settings update error:", err);
            return reply.status(500).send({ success: false, message: "Failed to update settings" });
        }
    });

    // ---- WhatsApp group settings: announce / restrict / approval (live) ----
    fastify.put("/groups/:groupId/wa-settings", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const body = request.body as {
            announce?: boolean;
            restrict?: boolean;
            joinApprovalMode?: boolean;
        };
        const access = await requireAccess(request, reply, groupId);
        if (!access) return;
        const admin = getAdmin(request);
        const client = getClientInstance()!;
        const changes: string[] = [];

        try {
            if (body.announce !== undefined) {
                await (client as any).groupSettingUpdate(groupId, body.announce ? "announcement" : "not_announcement");
                await Database.group.update({ where: { groupId }, data: { announce: body.announce } }).catch(() => {});
                changes.push(`"Only admins can send messages" ${onOff(body.announce)}`);
            }
            if (body.restrict !== undefined) {
                await (client as any).groupSettingUpdate(groupId, body.restrict ? "locked" : "unlocked");
                await Database.group.update({ where: { groupId }, data: { restrict: body.restrict } }).catch(() => {});
                changes.push(`"Only admins can edit group info" ${onOff(body.restrict)}`);
            }
            if (body.joinApprovalMode !== undefined) {
                await (client as any).groupJoinApprovalMode(groupId, body.joinApprovalMode ? "on" : "off");
                await Database.group.update({ where: { groupId }, data: { joinApprovalMode: body.joinApprovalMode } }).catch(() => {});
                changes.push(`"New member approval" ${onOff(body.joinApprovalMode)}`);
            }
            if (changes.length) {
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: "wa-setting",
                    detail: changes.join(", "),
                });
                await notifyGroupChange(groupId, admin.phoneNumber, changes);
            }
            return reply.send({ success: true, changed: changes });
        } catch (err) {
            logger.error("group-admin wa-settings error:", err);
            return reply.status(500).send({ success: false, message: "Failed to update WhatsApp group settings" });
        }
    });

    // ---- Group profile picture (live) --------------------------------------
    fastify.post(
        "/groups/:groupId/profile-picture",
        { bodyLimit: UPLOAD_BODY_LIMIT },
        async (request, reply) => {
            const { groupId } = request.params as { groupId: string };
            const body = request.body as { image?: string };
            const access = await requireAccess(request, reply, groupId);
            if (!access) return;
            const admin = getAdmin(request);
            const client = getClientInstance()!;

            const buffer = decodeBase64Image(body.image || "");
            if (!buffer) {
                return reply.status(400).send({ success: false, message: "A valid image is required" });
            }

            try {
                await (client as any).updateProfilePicture(groupId, buffer);
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: "profile-picture",
                });
                return reply.send({ success: true });
            } catch (err) {
                logger.error("group-admin profile-picture error:", err);
                return reply.status(500).send({ success: false, message: "Failed to update group picture" });
            }
        }
    );

    // ---- Invite link -------------------------------------------------------
    fastify.get("/groups/:groupId/invite-link", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const access = await requireAccess(request, reply, groupId);
        if (!access) return;
        const client = getClientInstance()!;
        try {
            const code = await (client as any).groupInviteCode(groupId);
            return reply.send({ success: true, link: `https://chat.whatsapp.com/${code}`, code });
        } catch (err) {
            logger.error("group-admin invite-link error:", err);
            return reply.status(500).send({ success: false, message: "Failed to get invite link" });
        }
    });

    fastify.post("/groups/:groupId/revoke-link", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const access = await requireAccess(request, reply, groupId);
        if (!access) return;
        const admin = getAdmin(request);
        const client = getClientInstance()!;
        try {
            const code = await (client as any).groupRevokeInvite(groupId);
            await logGroupAction({ groupId, actorPn: admin.phoneNumber, action: "revoke-link" });
            return reply.send({
                success: true,
                link: code ? `https://chat.whatsapp.com/${code}` : null,
            });
        } catch (err) {
            logger.error("group-admin revoke-link error:", err);
            return reply.status(500).send({ success: false, message: "Failed to revoke invite link" });
        }
    });

    // ---- Welcome / leave layout config -------------------------------------
    const configField = (variant: LayoutVariant) =>
        variant === "welcome" ? "welcomeConfig" : "leaveConfig";
    const messageField = (variant: LayoutVariant) =>
        variant === "welcome" ? "welcomeMessage" : "leaveMessage";

    fastify.get("/groups/:groupId/layout/:variant", async (request, reply) => {
        const { groupId, variant } = request.params as { groupId: string; variant: LayoutVariant };
        if (variant !== "welcome" && variant !== "leave") {
            return reply.status(400).send({ success: false, message: "Invalid variant" });
        }
        const access = await requireAccess(request, reply, groupId, false);
        if (!access) return;

        const group = await Database.group.findUnique({
            where: { groupId },
            select: { settings: true },
        });
        const stored = (group?.settings as any)?.[configField(variant)];
        const config = resolveLayoutConfig(variant, stored);
        // Keep the caption in sync with the message field used at send time.
        const msg = (group?.settings as any)?.[messageField(variant)];
        if (typeof msg === "string") config.caption = msg;
        return reply.send({ success: true, variant, config });
    });

    fastify.put(
        "/groups/:groupId/layout/:variant",
        { bodyLimit: UPLOAD_BODY_LIMIT },
        async (request, reply) => {
            const { groupId, variant } = request.params as { groupId: string; variant: LayoutVariant };
            if (variant !== "welcome" && variant !== "leave") {
                return reply.status(400).send({ success: false, message: "Invalid variant" });
            }
            const access = await requireAccess(request, reply, groupId, false);
            if (!access) return;
            const admin = getAdmin(request);
            const body = request.body as { config?: unknown };

            // Normalize through the resolver so only known fields are stored.
            const config = resolveLayoutConfig(variant, body.config);

            const existing = await Database.group.findUnique({ where: { groupId } });
            if (!existing) {
                return reply.status(404).send({ success: false, message: "Group not found" });
            }
            const settings: any = { ...existing.settings };
            settings[configField(variant)] = config;
            // Mirror the caption to the message field consumed by the join/leave handler.
            if (typeof config.caption === "string" && config.caption.trim()) {
                settings[messageField(variant)] = config.caption;
            }

            try {
                await Database.group.update({ where: { groupId }, data: { settings } });
                await logGroupAction({
                    groupId,
                    actorPn: admin.phoneNumber,
                    action: variant === "welcome" ? "welcome-config" : "leave-config",
                });
                return reply.send({ success: true, config });
            } catch (err) {
                logger.error("group-admin layout save error:", err);
                return reply.status(500).send({ success: false, message: "Failed to save layout" });
            }
        }
    );

    // Upload a custom background image; returns a public URL to embed in config.
    fastify.post(
        "/groups/:groupId/layout/:variant/background",
        { bodyLimit: UPLOAD_BODY_LIMIT },
        async (request, reply) => {
            const { groupId, variant } = request.params as { groupId: string; variant: LayoutVariant };
            if (variant !== "welcome" && variant !== "leave") {
                return reply.status(400).send({ success: false, message: "Invalid variant" });
            }
            const access = await requireAccess(request, reply, groupId, false);
            if (!access) return;

            const body = request.body as { image?: string };
            const buffer = decodeBase64Image(body.image || "");
            if (!buffer) {
                return reply.status(400).send({ success: false, message: "A valid image is required" });
            }

            try {
                if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
                const safeId = groupId.replace(/[^0-9a-zA-Z]/g, "_");
                const filename = `${safeId}-${variant}-${Date.now()}.png`;
                const fsPath = path.join(UPLOAD_DIR, filename);
                fs.writeFileSync(fsPath, buffer);
                const url = `/uploads/welcome/${filename}`;
                invalidateBackgroundCache(url);
                return reply.send({ success: true, url });
            } catch (err) {
                logger.error("group-admin background upload error:", err);
                return reply.status(500).send({ success: false, message: "Failed to save background" });
            }
        }
    );

    // Live preview of an (unsaved) config — returns a PNG.
    fastify.post(
        "/groups/:groupId/layout/:variant/preview",
        { bodyLimit: UPLOAD_BODY_LIMIT },
        async (request, reply) => {
            const { groupId, variant } = request.params as { groupId: string; variant: LayoutVariant };
            if (variant !== "welcome" && variant !== "leave") {
                return reply.status(400).send({ success: false, message: "Invalid variant" });
            }
            const access = await requireAccess(request, reply, groupId, false);
            if (!access) return;
            const body = request.body as { config?: unknown };

            // Use the group's own picture as the sample avatar when available.
            let profileUrl = "";
            try {
                const client = getClientInstance();
                if (client) profileUrl = await (client as any).profilePictureUrl(groupId, "image").catch(() => "");
            } catch {}

            try {
                const buffer = await renderLayoutPreview(variant, body.config, {
                    profileUrl,
                    groupName: access.meta?.subject || "Sample Group",
                });
                reply.header("Content-Type", "image/png");
                reply.header("Cache-Control", "no-store");
                return reply.send(buffer);
            } catch (err) {
                logger.error("group-admin preview error:", err);
                return reply.status(500).send({ success: false, message: "Failed to render preview" });
            }
        }
    );

    // ---- Audit logs --------------------------------------------------------
    fastify.get("/groups/:groupId/logs", async (request, reply) => {
        const { groupId } = request.params as { groupId: string };
        const { page = 1, limit = 30 } = request.query as { page?: number; limit?: number };
        const access = await requireAccess(request, reply, groupId, false);
        if (!access) return;

        try {
            const take = Math.min(100, Math.max(1, Number(limit)));
            const skip = (Math.max(1, Number(page)) - 1) * take;
            const { logs, total } = await getGroupLogs(groupId, take, skip);
            return reply.send({
                success: true,
                logs,
                pagination: { page: Number(page), limit: take, total, totalPages: Math.ceil(total / take) },
            });
        } catch (err) {
            logger.error("group-admin logs error:", err);
            return reply.status(500).send({ success: false, message: "Failed to load logs" });
        }
    });
}
