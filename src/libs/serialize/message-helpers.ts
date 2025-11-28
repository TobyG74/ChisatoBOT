export class MessageSerializationHelper {
    private static typeCache = new Map<string, string>();
    private static bodyCache = new WeakMap<any, string>();

    /**
     * Get message type with caching
     */
    static getMessageType(message: any): string | undefined {
        if (!message?.message) return undefined;

        const msgKeys = Object.keys(message.message);
        const cacheKey = msgKeys.join(",");

        if (this.typeCache.has(cacheKey)) {
            return this.typeCache.get(cacheKey);
        }

        const type = msgKeys.find(
            (type) =>
                ![
                    "senderKeyDistributionMessage",
                    "messageContextInfo",
                    "documentWithCaptionMessage",
                ].includes(type)
        );

        if (type) {
            this.typeCache.set(cacheKey, type);
        }

        return type;
    }

    /**
     * Extract body from message with caching
     */
    static getMessageBody(message: any, type: string): string | undefined {
        if (!message?.message || !type) return undefined;

        if (this.bodyCache.has(message)) {
            return this.bodyCache.get(message);
        }

        const msgContent = message.message[type];
        if (!msgContent) return undefined;

        let body: string | undefined;

        if (type === "conversation") {
            body = msgContent;
        } else if (type === "extendedTextMessage") {
            body = msgContent.text;
        } else if (type === "imageMessage" || type === "videoMessage") {
            body = msgContent.caption;
        } else if (type === "documentWithCaptionMessage") {
            body = msgContent.message?.documentMessage?.caption;
        } else if (type === "templateButtonReplyMessage") {
            body = msgContent.selectedId;
        } else if (type === "buttonsResponseMessage") {
            body = msgContent.selectedButtonId;
        } else if (type === "listResponseMessage") {
            body = msgContent.singleSelectReply?.selectedRowId;
        }

        if (body) {
            this.bodyCache.set(message, body);
        }

        return body;
    }

    /**
     * Check if message is from group
     */
    static isGroupMessage(jid: string | null | undefined): boolean {
        return jid?.endsWith("@g.us") ?? false;
    }

    /**
     * Check if message is from me
     */
    static isFromMe(key: any): boolean {
        return key?.fromMe ?? false;
    }

    /**
     * Extract sender from message
     */
    static getSender(message: any, Chisato: any): string | undefined {
        if (!message?.key) return undefined;

        if (message.key.fromMe) {
            return Chisato?.user?.id
                ? this.decodeJid(Chisato.user.id, Chisato)
                : undefined;
        }

        if (this.isGroupMessage(message.key.remoteJid)) {
            return message.key.participant
                ? this.decodeJid(message.key.participant, Chisato)
                : undefined;
        }

        return message.key.remoteJid
            ? this.decodeJid(message.key.remoteJid, Chisato)
            : undefined;
    }

    /**
     * Decode JID
     */
    static decodeJid(jid: string, Chisato: any): string {
        if (!jid || typeof jid !== "string") return jid;

        if (/:\d+@/gi.test(jid)) {
            const decode = Chisato?.jidDecode?.(jid);
            return (
                (decode?.user &&
                    decode?.server &&
                    decode.user + "@" + decode.server) ||
                jid
            );
        }
        return jid;
    }

    /**
     * Clear caches (call periodically to prevent memory leaks)
     */
    static clearCaches(): void {
        this.typeCache.clear();
    }

    /**
     * Get cache statistics
     */
    static getCacheStats(): { typeCacheSize: number } {
        return {
            typeCacheSize: this.typeCache.size,
        };
    }
}
