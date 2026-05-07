/**
 * Anonymous Chat = shared in-memory state
 *
 * Sessions and queue are module-level singletons that live for the
 * lifetime of the bot process. No persistence is needed; if the bot
 * restarts, all sessions end naturally.
 */

/** JIDs currently waiting to be matched with a partner */
export const waitingQueue: string[] = [];

/**
 * Active paired sessions (bidirectional).
 * anonChatSessions.get(jidA) === jidB  AND
 * anonChatSessions.get(jidB) === jidA
 */
export const anonChatSessions = new Map<string, string>();

/** Add a JID to the waiting queue (idempotent) */
export function joinQueue(jid: string): void {
    if (!waitingQueue.includes(jid)) {
        waitingQueue.push(jid);
    }
}

/** Remove a JID from the waiting queue */
export function leaveQueue(jid: string): void {
    const idx = waitingQueue.indexOf(jid);
    if (idx !== -1) waitingQueue.splice(idx, 1);
}

/** Whether the JID is in an active chat session */
export function isInSession(jid: string): boolean {
    return anonChatSessions.has(jid);
}

/** Whether the JID is in the waiting queue */
export function isInQueue(jid: string): boolean {
    return waitingQueue.includes(jid);
}

/** Get the partner JID for an active session */
export function getPartner(jid: string): string | undefined {
    return anonChatSessions.get(jid);
}

/** Pair two JIDs (internal) */
function pairUsers(jidA: string, jidB: string): void {
    anonChatSessions.set(jidA, jidB);
    anonChatSessions.set(jidB, jidA);
}

/**
 * Dequeue two users and pair them.
 * @returns [jidA, jidB] if a match was made, null if not enough users.
 */
export function tryMatch(): [string, string] | null {
    if (waitingQueue.length >= 2) {
        const jidA = waitingQueue.shift()!;
        const jidB = waitingQueue.shift()!;
        pairUsers(jidA, jidB);
        return [jidA, jidB];
    }
    return null;
}

/**
 * End the session for a JID (and remove partner's entry too).
 * @returns the partner's JID if there was an active session, or null.
 */
export function endSession(jid: string): string | null {
    const partner = anonChatSessions.get(jid) ?? null;
    anonChatSessions.delete(jid);
    if (partner) anonChatSessions.delete(partner);
    return partner;
}
