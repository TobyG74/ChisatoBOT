import type { Client } from "@libs/client/client";
import type { MessageSerialize } from "../../../types/structure/serialize";
import type { Database } from "../../../types/structure/commands";
import { BotConfig } from "@core/config";
import { indexGroupMetaForLidResolution } from "../../../utils/jid-resolver";

interface TTLCache<T> {
    value: T;
    expiresAt: number;
}

const BLOCKLIST_TTL  = 5  * 60 * 1000; // 5 minutes
const USER_TTL       = 5  * 60 * 1000; // 5 minutes  
const GROUP_META_TTL = 2  * 60 * 1000; // 2 minutes  
const GROUP_DB_TTL   = 10 * 60 * 1000; // 10 minutes
const SWEEP_INTERVAL = 5  * 60 * 1000; // sweep every 5 minutes

const MAX_USER_CACHE  = 500;
const MAX_GROUP_CACHE = 300;

/**
 * MessageContextBuilder is responsible for constructing a comprehensive context object for each incoming message.
 */

export class MessageContextBuilder {
    private static blockListCache: TTLCache<string[]> | null = null;
    private static botNumberCache: string | null = null;
    private static userCache      = new Map<string, TTLCache<any>>();
    private static groupMetaCache = new Map<string, TTLCache<any>>();
    private static groupDbCache   = new Map<string, TTLCache<any>>();

    /** Sweep all caches, deleting expired entries. Called on a timer. */
    static sweep(): void {
        const now = Date.now();
        for (const [k, v] of MessageContextBuilder.userCache)
            if (now >= v.expiresAt) MessageContextBuilder.userCache.delete(k);
        for (const [k, v] of MessageContextBuilder.groupMetaCache)
            if (now >= v.expiresAt) MessageContextBuilder.groupMetaCache.delete(k);
        for (const [k, v] of MessageContextBuilder.groupDbCache)
            if (now >= v.expiresAt) MessageContextBuilder.groupDbCache.delete(k);
    }

    /** Evict oldest entry if the cache is over its size limit. */
    private static prune<T>(cache: Map<string, TTLCache<T>>, max: number): void {
        if (cache.size > max) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) cache.delete(firstKey);
        }
    }

    static invalidateUser(sender: string): void {
        MessageContextBuilder.userCache.delete(sender);
    }
    static invalidateGroup(jid: string): void {
        MessageContextBuilder.groupMetaCache.delete(jid);
        MessageContextBuilder.groupDbCache.delete(jid);
    }
    static invalidateBlockList(): void {
        MessageContextBuilder.blockListCache = null;
    }

    /** Returns cached group metadata for use by Baileys cachedGroupMetadata option. */
    static getCachedGroupMeta(jid: string): any | undefined {
        const entry = MessageContextBuilder.groupMetaCache.get(jid);
        return (entry && Date.now() < entry.expiresAt) ? entry.value : undefined;
    }

    /** Stores group metadata directly (used by client groups.upsert handler). */
    static setCachedGroupMeta(jid: string, meta: any): void {
        MessageContextBuilder.prune(MessageContextBuilder.groupMetaCache, MAX_GROUP_CACHE);
        MessageContextBuilder.groupMetaCache.set(jid, {
            value: meta,
            expiresAt: Date.now() + GROUP_META_TTL,
        });
        // Feed any (lid, phoneNumber) pairs into the LID→PN resolver cache so
        indexGroupMetaForLidResolution(meta);
    }

    private static async getBlockList(Chisato: Client): Promise<string[]> {
        const now = Date.now();
        const cache = MessageContextBuilder.blockListCache;
        if (cache && now < cache.expiresAt) return cache.value;
        try {
            const list = await Chisato.fetchBlocklist();
            MessageContextBuilder.blockListCache = { value: list, expiresAt: now + BLOCKLIST_TTL };
            return list;
        } catch {
            return cache?.value ?? [];
        }
    }

    private static async getBotNumber(Chisato: Client): Promise<string> {
        if (MessageContextBuilder.botNumberCache) return MessageContextBuilder.botNumberCache;
        const num = await Chisato.decodeJid(Chisato.user.id);
        MessageContextBuilder.botNumberCache = num;
        return num;
    }

    private static async getUserMetadata(User: any, Chisato: Client, sender: string, pushName: string): Promise<any> {
        const now = Date.now();
        const cached = MessageContextBuilder.userCache.get(sender);
        if (cached && now < cached.expiresAt) return cached.value;
        const data = (await User.get(sender)) ?? (await User.upsert(Chisato, sender, pushName));
        MessageContextBuilder.prune(MessageContextBuilder.userCache, MAX_USER_CACHE);
        MessageContextBuilder.userCache.set(sender, { value: data, expiresAt: now + USER_TTL });
        return data;
    }

    private static async getGroupMetadata(Chisato: Client, from: string): Promise<any> {
        const now = Date.now();
        const cached = MessageContextBuilder.groupMetaCache.get(from);
        if (cached && now < cached.expiresAt) return cached.value;
        try {
            const meta = await Chisato.groupMetadata(from);
            if (meta) {
                MessageContextBuilder.prune(MessageContextBuilder.groupMetaCache, MAX_GROUP_CACHE);
                MessageContextBuilder.groupMetaCache.set(from, { value: meta, expiresAt: now + GROUP_META_TTL });
                indexGroupMetaForLidResolution(meta);
            }
            return meta;
        } catch {
            return null;
        }
    }

    private static async getGroupDb(Group: any, Chisato: Client, from: string): Promise<any> {
        const now = Date.now();
        const cached = MessageContextBuilder.groupDbCache.get(from);
        if (cached && now < cached.expiresAt) return cached.value;
        const data = await Group.get(from);
        const result = data ?? (await Group.upsert(Chisato, from));
        if (result) {
            MessageContextBuilder.prune(MessageContextBuilder.groupDbCache, MAX_GROUP_CACHE);
            MessageContextBuilder.groupDbCache.set(from, { value: result, expiresAt: now + GROUP_DB_TTL });
        }
        return result;
    }

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

            const botLid = Chisato.user.lid;
            const botName = Chisato.user.name;

            const prefix =
                body && /^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?#$%^&.©^]/gi.test(body)
                    ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓/_=|~!?#$%^&.©^]/gi)![0]
                    : config.prefix;

            const isCmd = body ? body.startsWith(prefix) : false;
            const cmd =
                isCmd && body
                    ? body.replace(prefix, "").split(/ +/).shift()?.toLowerCase()
                    : undefined;

            // Run botNumber + blockList + userMetadata in parallel
            const [botNumber, blockList, userMetadata] = await Promise.all([
                MessageContextBuilder.getBotNumber(Chisato),
                MessageContextBuilder.getBlockList(Chisato),
                MessageContextBuilder.getUserMetadata(User, Chisato, sender, pushName),
            ]);

            // Group data
            let groupMetadata: MessageContext["groupMetadata"] = undefined;
            let groupSettingData: MessageContext["groupSettingData"] = undefined;
            let groupName: string | undefined = undefined;
            let groupDescription: string | undefined = undefined;
            let groupParticipants: MessageContext["groupParticipants"] = undefined;
            let groupAdmins: MessageContext["groupAdmins"] = undefined;

            if (isGroup) {
                // Fetch WA group metadata (cached) and DB group record (cached) in parallel
                const [waMeta, dbGroup] = await Promise.all([
                    MessageContextBuilder.getGroupMetadata(Chisato, from),
                    MessageContextBuilder.getGroupDb(Group, Chisato, from),
                ]);

                groupMetadata = waMeta || dbGroup;

                if (groupMetadata) {
                    groupSettingData = dbGroup?.settings ?? dbGroup;
                    groupName = groupMetadata.subject;
                    groupDescription = groupMetadata.desc;
                    groupParticipants = groupMetadata.participants;
                    groupAdmins = groupMetadata.participants?.filter(
                        (v: any) => v.admin !== null
                    );
                }
            }

            // Permissions
            const botNumberClean = botNumber;
            const isOwner =
                fromMe ||
                sender === botNumber ||
                [...config.ownerNumber, botNumberClean].includes(sender.split("@")[0]);

            const isTeam =
                fromMe ||
                sender === botNumber ||
                [...config.teamNumber, ...config.ownerNumber, botNumberClean].includes(sender.split("@")[0]);

            const isGroupAdmin = isGroup && !!groupAdmins?.find((v: any) => v.phoneNumber === sender);
            const isGroupOwner = isGroup && !!groupAdmins?.find((v: any) => v.phoneNumber === sender && v.admin === "superadmin");
            const isBotAdmin = isGroup && !!groupAdmins?.find((v: any) => v.phoneNumber === botNumber);
            const isBlock = blockList.includes(sender);
            const isBanned = isGroup && groupSettingData?.banned?.includes(sender);
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

// Periodically evict expired entries so the Maps don't grow forever.
// .unref() ensures this timer doesn't prevent the process from exiting cleanly.
setInterval(() => MessageContextBuilder.sweep(), SWEEP_INTERVAL).unref();
