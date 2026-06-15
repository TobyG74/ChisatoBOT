/**
 * group-access.service
 *
 * Authorization helpers for the group-admin dashboard. A group admin may only
 * act on groups where they are genuinely an admin AND where the bot itself is
 * an admin (otherwise the WhatsApp operation would just fail).
 */

import { Database } from "../../infrastructure/database";
import type { Client } from "../../libs";
import {
    resolveToPnJidSync,
    indexGroupMetaForLidResolution,
} from "../../utils/jid-resolver";

export type AdminGroupSummary = {
    groupId: string;
    subject: string;
    size: number;
    isSuperAdmin: boolean;
    botIsAdmin: boolean;
};

/** Extract the bare phone number a participant maps to, if known synchronously. */
function participantPn(p: any): string | null {
    const candidates = [p?.phoneNumber, p?.id, p?.lid];
    for (const c of candidates) {
        if (!c) continue;
        const resolved = resolveToPnJidSync(c);
        if (resolved && resolved.endsWith("@s.whatsapp.net")) {
            return resolved.split("@")[0];
        }
        if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) {
            return c.split("@")[0];
        }
    }
    return null;
}

/** Bare phone number of the connected bot, e.g. `628xxxx`. */
export function getBotPhoneNumber(client: Client | null): string {
    const raw = (client as any)?.user?.id || "";
    return String(raw).split(":")[0].split("@")[0];
}

/**
 * Find every group (from the database) where `phoneNumber` is an admin.
 * `phoneNumber` is the bare number (no suffix), e.g. `628xxxx`.
 */
export async function findAdminGroupsFromDb(
    phoneNumber: string,
    client: Client | null
): Promise<AdminGroupSummary[]> {
    const botPn = getBotPhoneNumber(client);

    const groups = await Database.group.findMany({
        select: {
            groupId: true,
            subject: true,
            size: true,
            participants: true,
        },
    });

    const result: AdminGroupSummary[] = [];
    for (const g of groups) {
        const participants = g.participants || [];
        let requester: any = null;
        let bot: any = null;
        for (const p of participants) {
            const pn = participantPn(p);
            if (!pn) continue;
            if (pn === phoneNumber) requester = p;
            if (botPn && pn === botPn) bot = p;
        }
        if (!requester) continue;
        if (requester.admin !== "admin" && requester.admin !== "superadmin") continue;

        result.push({
            groupId: g.groupId,
            subject: g.subject,
            size: g.size ?? participants.length,
            isSuperAdmin: requester.admin === "superadmin",
            botIsAdmin:
                bot?.admin === "admin" || bot?.admin === "superadmin",
        });
    }
    return result;
}

/**
 * Find the in-group JID (which may be a LID) for a member identified by their
 * bare phone number, using live metadata. Returns the participant's actual
 * `id` so participant-update operations target the right entity in LID groups.
 */
export function resolveMemberJid(meta: any, phoneNumber: string): string | null {
    for (const p of meta?.participants || []) {
        if (participantPn(p) === phoneNumber) {
            return p.id || p.jid || null;
        }
    }
    return null;
}

/** Map live metadata participants to a dashboard-friendly shape. */
export function mapParticipants(
    meta: any
): Array<{ jid: string; phoneNumber: string | null; admin: string | null }> {
    return (meta?.participants || []).map((p: any) => ({
        jid: p.id || p.jid || "",
        phoneNumber: participantPn(p),
        admin: p.admin ?? null,
    }));
}

/**
 * Check whether `phoneNumber` is an admin within arbitrary group metadata — e.g.
 * the metadata returned by `groupGetInviteInfo` for a group the bot has NOT
 * joined yet. Used to authorize "add the bot via invite link": a requester may
 * only bring the bot into a group they themselves administer. Indexes LID
 * mappings first so participant→phone resolution works on fresh metadata.
 */
export function checkAdminInMeta(
    meta: any,
    phoneNumber: string
): { found: boolean; isAdmin: boolean; isSuperAdmin: boolean } {
    try {
        indexGroupMetaForLidResolution(meta);
    } catch {
        /* best-effort */
    }
    for (const p of meta?.participants || []) {
        if (participantPn(p) === phoneNumber) {
            const admin = p.admin === "admin" || p.admin === "superadmin";
            return { found: true, isAdmin: admin, isSuperAdmin: p.admin === "superadmin" };
        }
    }
    return { found: false, isAdmin: false, isSuperAdmin: false };
}

export type GroupAccessResult = {
    ok: boolean;
    reason?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    botIsAdmin: boolean;
    /** Live group metadata (when available) so callers can avoid a second fetch. */
    meta?: any;
};

/**
 * Authoritatively verify that `phoneNumber` may administer `groupId` right now.
 * Fetches fresh metadata from WhatsApp; requires both requester and bot to be
 * admins. `requireBotAdmin` can be relaxed for read-only operations.
 */
export async function verifyGroupAdminAccess(
    client: Client | null,
    groupId: string,
    phoneNumber: string,
    requireBotAdmin = true
): Promise<GroupAccessResult> {
    if (!client) {
        return {
            ok: false,
            reason: "Bot is not connected.",
            isAdmin: false,
            isSuperAdmin: false,
            botIsAdmin: false,
        };
    }

    let meta: any;
    try {
        meta = await (client as any).groupMetadata(groupId);
    } catch {
        return {
            ok: false,
            reason: "Group not found or the bot is no longer a member.",
            isAdmin: false,
            isSuperAdmin: false,
            botIsAdmin: false,
        };
    }

    indexGroupMetaForLidResolution(meta);

    const botPn = getBotPhoneNumber(client);
    let requester: any = null;
    let bot: any = null;
    for (const p of meta?.participants || []) {
        const pn = participantPn(p);
        if (!pn) continue;
        if (pn === phoneNumber) requester = p;
        if (botPn && pn === botPn) bot = p;
    }

    const isAdmin =
        requester?.admin === "admin" || requester?.admin === "superadmin";
    const isSuperAdmin = requester?.admin === "superadmin";
    const botIsAdmin =
        bot?.admin === "admin" || bot?.admin === "superadmin";

    if (!isAdmin) {
        return {
            ok: false,
            reason: "You are no longer an admin of this group.",
            isAdmin: false,
            isSuperAdmin: false,
            botIsAdmin,
            meta,
        };
    }

    if (requireBotAdmin && !botIsAdmin) {
        return {
            ok: false,
            reason: "The bot must be a group admin to perform this action.",
            isAdmin,
            isSuperAdmin,
            botIsAdmin,
            meta,
        };
    }

    return { ok: true, isAdmin, isSuperAdmin, botIsAdmin, meta };
}
