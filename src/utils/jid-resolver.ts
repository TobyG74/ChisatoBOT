/**
 * jid-resolver
 *
 * WhatsApp now sends mentions, quoted senders, and group participants in
 * "LID" form (e.g. `12345678901234@lid`) instead of the historical phone-
 * number JID (`628xxxxxxxxxx@s.whatsapp.net`). The rest of this codebase —
 * database lookups, group operations, message templates — uses the PN form,
 * so we need a single robust function to convert any LID JID to PN.
 */

import type { Client } from "../libs";

type ParticipantLike = {
    id?: string | null;
    lid?: string | null;
    phoneNumber?: string | null;
};

type GroupMetaLike = {
    participants?: ParticipantLike[];
};

const LID_SUFFIXES = ["@lid", "@hosted.lid"] as const;
const PN_SUFFIXES = ["@s.whatsapp.net", "@hosted"] as const;

/** Strip the optional device suffix `:0`, `:1` */
function stripDevice(user: string): string {
    const colon = user.indexOf(":");
    return colon === -1 ? user : user.slice(0, colon);
}

/** Returns the user portion of a JID, without device suffix. */
function jidUser(jid: string): string {
    const at = jid.indexOf("@");
    if (at === -1) return stripDevice(jid);
    return stripDevice(jid.slice(0, at));
}

function isLid(jid: string): boolean {
    return LID_SUFFIXES.some((suffix) => jid.endsWith(suffix));
}

function isPn(jid: string): boolean {
    return PN_SUFFIXES.some((suffix) => jid.endsWith(suffix));
}

/**
 * In-process cache for `lidUser → pnJid` resolutions sourced from group
 * metadata. Persisted only for the lifetime of the process; the Baileys
 * lid-mapping store handles long-term persistence.
 */
const lidUserToPnCache = new Map<string, string>();

/** Add a (lidUser → pnJid) mapping to the local cache. */
function cacheLidPn(lidUser: string, pnJid: string): void {
    if (!lidUser || !pnJid) return;
    lidUserToPnCache.set(lidUser, pnJid);
}

/**
 * Walk a group's participant list and feed any (lid, phoneNumber) pairs into
 * the local resolver cache. Safe to call repeatedly; it's a no-op if the
 * shape isn't recognised.
 */
export function indexGroupMetaForLidResolution(meta: GroupMetaLike | null | undefined): void {
    if (!meta?.participants?.length) return;
    for (const p of meta.participants) {
        const phoneNumber = p?.phoneNumber || (p?.id && isPn(p.id) ? p.id : null);
        if (!phoneNumber) continue;
        // Direct lid field
        if (p.lid && isLid(p.lid)) {
            cacheLidPn(jidUser(p.lid), phoneNumber);
        }
        // Some Baileys versions use `id` as the LID when addressingMode = lid
        if (p.id && isLid(p.id)) {
            cacheLidPn(jidUser(p.id), phoneNumber);
        }
    }
}

/**
 * Resolve a single JID to its phone-number form. Returns the original JID
 * (with device suffix stripped) if no mapping is known.
 */
export async function resolveToPnJid(
    Chisato: Client,
    jid: string | null | undefined,
    fallbackGroupMeta?: GroupMetaLike | null
): Promise<string> {
    if (!jid) return "";

    // Already a PN-form JID — just strip device suffix and return.
    if (isPn(jid)) {
        return Chisato.decodeJid(jid);
    }

    // Not LID-form? Nothing to translate.
    if (!isLid(jid)) {
        return Chisato.decodeJid(jid);
    }

    const lidUser = jidUser(jid);

    try {
        const signalRepo = (Chisato as any).signalRepository;
        const pn: string | null | undefined = await signalRepo?.lidMapping?.getPNForLID?.(jid);
        if (pn) {
            const decoded = await Chisato.decodeJid(pn);
            if (decoded) {
                cacheLidPn(lidUser, decoded);
                return decoded;
            }
        }
    } catch {
        /* ignore — try fallbacks */
    }

    const cached = lidUserToPnCache.get(lidUser);
    if (cached) return cached;

    if (fallbackGroupMeta?.participants?.length) {
        indexGroupMetaForLidResolution(fallbackGroupMeta);
        const hit = lidUserToPnCache.get(lidUser);
        if (hit) return hit;
    }

    // least get a stable identifier. They can compare on user-part only.
    return Chisato.decodeJid(jid);
}

/**
 * Resolve an array of JIDs to PN form. Optimised to make a single batch call
 * against the Baileys signal repository before falling back per-entry.
 */
export async function resolveAllToPnJids(
    Chisato: Client,
    jids: string[] | null | undefined,
    fallbackGroupMeta?: GroupMetaLike | null
): Promise<string[]> {
    if (!jids?.length) return [];

    // Try a single batch lookup for any LID-form JIDs first.
    const lidJids = jids.filter(isLid);
    if (lidJids.length) {
        try {
            const signalRepo = (Chisato as any).signalRepository;
            const mappings: Array<{ lid: string; pn: string }> | null | undefined =
                await signalRepo?.lidMapping?.getPNsForLIDs?.(lidJids);
            if (mappings?.length) {
                for (const entry of mappings) {
                    const decoded = await Chisato.decodeJid(entry.pn);
                    if (decoded) cacheLidPn(jidUser(entry.lid), decoded);
                }
            }
        } catch {
            /* ignore */
        }
    }

    // Fold in any group-meta-derived mappings the caller can offer.
    if (fallbackGroupMeta) indexGroupMetaForLidResolution(fallbackGroupMeta);

    return Promise.all(jids.map((j) => resolveToPnJid(Chisato, j, fallbackGroupMeta)));
}
