import type { proto } from "baileys";

/**
 * In-process cache of recently-seen WhatsApp messages, keyed by `key.id`.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes — covers the practical revoke window
const MAX_ENTRIES = 1_000;

/** Minimal slice of `WAMessage` needed to forward + attribute the original. */
export type CachedMessage = {
    key: proto.IMessageKey;
    message: proto.IMessage;
    pushName?: string | null;
};

type Entry = {
    msg: CachedMessage;
    cachedAt: number;
};

const store = new Map<string, Entry>();

function evictOldestIfFull(): void {
    if (store.size < MAX_ENTRIES) return;
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
}

/** Strip a `WAMessage` to the fields anti-delete actually uses. */
function trim(message: proto.IWebMessageInfo): CachedMessage | null {
    if (!message?.key || !message.message) return null;
    return {
        key: message.key,
        message: message.message,
        pushName: message.pushName,
    };
}

export const antiDeleteCache = {
    /** Cache a message by its `key.id`. Skips messages without id or body. */
    put(message: proto.IWebMessageInfo): void {
        const id = message?.key?.id;
        if (!id) return;
        const trimmed = trim(message);
        if (!trimmed) return;
        evictOldestIfFull();
        store.set(id, { msg: trimmed, cachedAt: Date.now() });
    },

    /** Look up a cached message by id, returning null if not cached / expired. */
    get(id: string | null | undefined): CachedMessage | null {
        if (!id) return null;
        const entry = store.get(id);
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > TTL_MS) {
            store.delete(id);
            return null;
        }
        return entry.msg;
    },

    /** Drop a single id from the cache (e.g. after we've reposted it). */
    delete(id: string | null | undefined): void {
        if (!id) return;
        store.delete(id);
    },

    /** Current entry count (no lazy eviction — keep this O(1)). */
    size(): number {
        return store.size;
    },
};
