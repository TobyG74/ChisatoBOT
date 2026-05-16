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

const NEGATIVE_CACHE_TTL_MS = 60 * 1000; // 1 min — short enough that newly
                                         // learned mappings get picked up.

/** Strip the optional device suffix `:0`, `:1`, … from the user part of a JID. */
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

/** Server portion of a JID, e.g. `s.whatsapp.net`. */
function jidServer(jid: string): string {
    const at = jid.indexOf("@");
    return at === -1 ? "" : jid.slice(at + 1);
}

/**
 * Sync version of `Chisato.decodeJid`. Strips a device suffix `:0` from the
 * user part if present; otherwise returns the jid as-is. Identical to what
 * `decodeJid` does for normal JID shapes, just synchronous.
 */
function decodeJidSync(jid: string | null | undefined): string {
    if (!jid) return "";
    const at = jid.indexOf("@");
    if (at === -1) return jid.trim();
    const user = stripDevice(jid.slice(0, at));
    const server = jid.slice(at + 1);
    return `${user}@${server}`.trim();
}

/**
 * In-process cache for `lidUser → pnJid` resolutions. Populated from group
 * metadata participants and from successful signal-repo lookups. The Baileys
 * lid-mapping store handles long-term persistence; this map is just a fast
 * synchronous tier in front of it.
 */
const lidUserToPnCache = new Map<string, string>();

/** Negative cache: LIDs the signal repo couldn't resolve, with expiry time. */
const lidNegativeCache = new Map<string, number>();

/** Add a (lidUser → pnJid) mapping to the local cache. */
function cacheLidPn(lidUser: string, pnJid: string): void {
    if (!lidUser || !pnJid) return;
    lidUserToPnCache.set(lidUser, pnJid);
    lidNegativeCache.delete(lidUser);
}

function markLidUnknown(lidUser: string): void {
    if (!lidUser) return;
    lidNegativeCache.set(lidUser, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

function isLidNegativelyCached(lidUser: string): boolean {
    const expiry = lidNegativeCache.get(lidUser);
    if (!expiry) return false;
    if (expiry < Date.now()) {
        lidNegativeCache.delete(lidUser);
        return false;
    }
    return true;
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
        const decodedPn = decodeJidSync(phoneNumber);
        if (p.lid && isLid(p.lid)) {
            cacheLidPn(jidUser(p.lid), decodedPn);
        }
        if (p.id && isLid(p.id)) {
            cacheLidPn(jidUser(p.id), decodedPn);
        }
    }
}

/**
 * Synchronous fast-path resolver. Returns the PN form if it's already known
 * locally (or trivially resolvable), otherwise null. No `await`, no DB.
 */
function tryResolveSync(jid: string | null | undefined): string | null {
    if (!jid) return "";
    if (isPn(jid)) return decodeJidSync(jid);
    if (!isLid(jid)) return decodeJidSync(jid);
    const cached = lidUserToPnCache.get(jidUser(jid));
    return cached ?? null;
}

/**
 * Resolve a single JID to its phone-number form.
 *
 * Order of operations:
 *   1. Sync fast path (already PN, or local cache hit).
 *   2. Skip if recently confirmed unresolvable.
 *   3. Async lookup against `signalRepository.lidMapping`.
 *   4. Final fallback: caller-provided group metadata.
 *   5. Give up — return the LID with device suffix stripped.
 */
export async function resolveToPnJid(
    Chisato: Client,
    jid: string | null | undefined,
    fallbackGroupMeta?: GroupMetaLike | null
): Promise<string> {
    const sync = tryResolveSync(jid);
    if (sync !== null) return sync;

    // Past the sync path → jid is definitely a non-empty LID JID.
    const lidJid = jid as string;
    const lidU = jidUser(lidJid);

    if (isLidNegativelyCached(lidU)) {
        // Caller-supplied group meta might still rescue us.
        if (fallbackGroupMeta?.participants?.length) {
            indexGroupMetaForLidResolution(fallbackGroupMeta);
            const cached = lidUserToPnCache.get(lidU);
            if (cached) return cached;
        }
        return decodeJidSync(lidJid);
    }

    try {
        const signalRepo = (Chisato as any).signalRepository;
        const pn: string | null | undefined = await signalRepo?.lidMapping?.getPNForLID?.(lidJid);
        if (pn) {
            const decoded = decodeJidSync(pn);
            if (decoded) {
                cacheLidPn(lidU, decoded);
                return decoded;
            }
        }
    } catch {
        /* fall through to other fallbacks */
    }

    if (fallbackGroupMeta?.participants?.length) {
        indexGroupMetaForLidResolution(fallbackGroupMeta);
        const cached = lidUserToPnCache.get(lidU);
        if (cached) return cached;
    }

    markLidUnknown(lidU);
    return decodeJidSync(lidJid);
}

/**
 * Resolve an array of JIDs to PN form.
 *
 * Algorithm:
 *   1. Sync resolve everything we already know (cache hit / already PN /
 *      non-LID). Collect remaining LIDs into `unresolved`.
 *   2. If anything's still unresolved, batch-call
 *      `signalRepository.getPNsForLIDs` ONCE and populate the cache.
 *   3. Re-resolve the unresolved list synchronously from the cache, falling
 *      back to the LID itself if still unknown (and marking it negatively).
 *
 * The signal repo is contacted at most once per call regardless of array
 * length, and only for LIDs we don't already know.
 */
export async function resolveAllToPnJids(
    Chisato: Client,
    jids: string[] | null | undefined,
    fallbackGroupMeta?: GroupMetaLike | null
): Promise<string[]> {
    if (!jids?.length) return [];

    if (fallbackGroupMeta) indexGroupMetaForLidResolution(fallbackGroupMeta);

    const result = new Array<string>(jids.length);
    const unresolvedIdx: number[] = [];
    const lidsToBatch = new Set<string>();

    for (let i = 0; i < jids.length; i++) {
        const jid = jids[i];
        const sync = tryResolveSync(jid);
        if (sync !== null) {
            result[i] = sync;
            continue;
        }
        // Skip negative cache hits — fall back to bare LID without DB call.
        const lidU = jidUser(jid);
        if (!isLidNegativelyCached(lidU)) {
            lidsToBatch.add(jid);
        }
        unresolvedIdx.push(i);
    }

    if (lidsToBatch.size) {
        try {
            const signalRepo = (Chisato as any).signalRepository;
            const mappings: Array<{ lid: string; pn: string }> | null | undefined =
                await signalRepo?.lidMapping?.getPNsForLIDs?.([...lidsToBatch]);
            if (mappings?.length) {
                for (const entry of mappings) {
                    cacheLidPn(jidUser(entry.lid), decodeJidSync(entry.pn));
                }
            }
        } catch {
            /* ignore */
        }
    }

    for (const i of unresolvedIdx) {
        const jid = jids[i];
        const lidU = jidUser(jid);
        const cached = lidUserToPnCache.get(lidU);
        if (cached) {
            result[i] = cached;
        } else {
            // Don't retry this one against the signal repo for a while.
            markLidUnknown(lidU);
            result[i] = decodeJidSync(jid);
        }
    }

    return result;
}

/**
 * Synchronous resolver — useful when callers can tolerate a best-effort
 * answer (e.g. comparing against group metadata) and don't want to await
 * anything. Returns the LID unchanged (without device suffix) when no
 * mapping is known locally.
 */
export function resolveToPnJidSync(jid: string | null | undefined): string {
    return tryResolveSync(jid) ?? decodeJidSync(jid);
}

const _server = jidServer; // keep reference (used by tests; export-safe)
export const __internals = { jidUser, isLid, isPn, _server, decodeJidSync };
