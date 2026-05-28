import type { proto } from "baileys";
import { Client } from "../../../libs";
import { logger } from "../../../core/logger";
import { Group as GroupDatabase } from "../../../libs/database";
import { resolveToPnJid } from "../../../utils/jid-resolver";
import { antiDeleteCache } from "./anti-delete.cache";
import moment from "moment-timezone";

const SETTINGS_TTL = 5 * 60 * 1000; // 5 minutes

type RevokeUpdate = {
    key: proto.IMessageKey;
    update: {
        message?: proto.IMessage | null;
        messageStubType?: number;
        key?: proto.IMessageKey;
    };
};

export class AntiDeleteHandler {
    private Database = {
        Group: new GroupDatabase(),
    };

    private settingsCache = new Map<string, { value: any; expiresAt: number }>();

    // Track recently-handled revoke ids to suppress duplicate events
    private recentlyHandled = new Set<string>();

    private async getGroupAntiDeleteStatus(from: string): Promise<boolean> {
        const now = Date.now();
        const cached = this.settingsCache.get(from);
        if (cached && now < cached.expiresAt) return !!cached.value;
        try {
            const settings = await this.Database.Group.getSettings(from);
            const status = !!settings?.antidelete;
            this.settingsCache.set(from, { value: status, expiresAt: now + SETTINGS_TTL });
            return status;
        } catch {
            return false;
        }
    }

    /** Invalidate cached antidelete status for a group (call from the toggle command). */
    invalidate(from: string): void {
        this.settingsCache.delete(from);
    }

    async handle(Chisato: Client, evt: RevokeUpdate): Promise<void> {
        try {
            const originalKey = evt.key;
            const originalId = originalKey?.id;
            if (!originalId) return;

            if (this.recentlyHandled.has(originalId)) return;
            this.recentlyHandled.add(originalId);
            // Cap the dedup set so it can't grow unbounded.
            if (this.recentlyHandled.size > 1_000) {
                const first = this.recentlyHandled.values().next().value;
                if (first !== undefined) this.recentlyHandled.delete(first);
            }

            const chatJid = originalKey.remoteJid;
            if (!chatJid) return;

            // Anti-delete is group-only — skip private chats and broadcasts.
            const isGroup = chatJid.endsWith("@g.us");
            if (!isGroup) return;
            if (chatJid === "status@broadcast") return;

            // Per-group toggle.
            const enabled = await this.getGroupAntiDeleteStatus(chatJid);
            if (!enabled) return;

            // Look up the original message body from our cache.
            const cached = antiDeleteCache.get(originalId);
            if (!cached?.message) {
                logger.info(
                    `Anti-delete: revoke detected in ${chatJid} but original message ${originalId} not in cache`
                );
                return;
            }

            // Don't echo back the bot's own deleted messages
            if (cached.key?.fromMe) {
                antiDeleteCache.delete(originalId);
                return;
            }

            // Identify the deleter. `update.key` is the revoke envelope; its
            // `participant`/`fromMe` tells us who pressed delete-for-everyone.
            const revokeKey = evt.update?.key;
            const senderJid = cached.key?.participant || cached.key?.remoteJid || "";
            const deleterJid =
                revokeKey?.participant ||
                (revokeKey?.fromMe ? "" : revokeKey?.remoteJid || senderJid);

            // Resolve to PN so mentions render properly.
            const senderPn = senderJid ? await resolveToPnJid(Chisato, senderJid) : "";
            const deleterPn = deleterJid ? await resolveToPnJid(Chisato, deleterJid) : senderPn;

            const senderNum = senderPn.split("@")[0];
            const deleterNum = deleterPn.split("@")[0];
            const pushName = cached.pushName || "Unknown";
            const time = moment().format("HH:mm:ss DD/MM");

            const mentions = [senderPn, deleterPn].filter(Boolean) as string[];

            let header =
                `*「 ANTI-DELETE 」*\n\n` +
                `🗑 *Deleted message recovered*\n` +
                `• *Sender* : @${senderNum} (${pushName})\n`;
            if (deleterNum && deleterNum !== senderNum) {
                header += `• *Deleted by* : @${deleterNum}\n`;
            }
            header += `• *Time* : ${time}`;

            try {
                await Chisato.sendText(chatJid, header, undefined, {
                    mentions,
                } as any);
            } catch (err) {
                logger.error(
                    `Anti-delete: failed to send header in ${chatJid} — ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }

            // Forward the original message back to the chat
            try {
                await (Chisato as any).sendMessage(chatJid, {
                    forward: cached,
                });
            } catch (err) {
                logger.error(
                    `Anti-delete: failed to forward original message in ${chatJid} — ${
                        err instanceof Error ? err.message : String(err)
                    }`
                );
            }

            antiDeleteCache.delete(originalId);
            logger.info(
                `${time} | Anti-delete: recovered message ${originalId} in ${chatJid} (sender: ${pushName})`
            );
        } catch (error) {
            logger.error(
                `Anti-delete handler error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
