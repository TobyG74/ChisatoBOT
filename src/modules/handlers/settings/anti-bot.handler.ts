import { Client } from "../../../libs";
import { MessageSerialize } from "../../../types/structure/serialize";
import { logger } from "../../../core/logger";
import { Group as GroupDatabase } from "../../../libs/database";

/**
 * Message types that only a bot/API client can send.
 * Regular users on the official WA app cannot produce these natively.
 */
const BOT_ONLY_TYPES = new Set([
    "buttonsMessage",
    "buttonsResponseMessage",
    "listMessage",
    "listResponseMessage",
    "templateMessage",
    "templateButtonReplyMessage",
    "interactiveMessage",
    "interactiveResponseMessage",
    "highlyStructuredMessage",
    "hsm",
    "groupInviteMessage",  
    "productMessage",
    "orderMessage",
    "invoiceMessage",
    "requestPaymentMessage",
    "sendPaymentMessage",
    "declinePaymentRequestMessage",
    "cancelPaymentRequestMessage",
    "liveLocationMessage",
    "pollCreationMessage",
]);

const SETTINGS_TTL = 5 * 60 * 1000; // 5 minutes

export class AntiBotMessageHandler {
    private Database = {
        Group: new GroupDatabase(),
    };

    private settingsCache = new Map<string, { value: any; expiresAt: number }>();

    private async getGroupSettings(from: string): Promise<any> {
        const now = Date.now();
        const cached = this.settingsCache.get(from);
        if (cached && now < cached.expiresAt) return cached.value;
        const data = await this.Database.Group.getSettings(from);
        if (data) this.settingsCache.set(from, { value: data, expiresAt: now + SETTINGS_TTL });
        return data;
    }

    async handle(
        Chisato: Client,
        message: MessageSerialize,
        isOwner: boolean,
        isGroupAdmin: boolean
    ): Promise<void> {
        // Only trigger in groups, for non-admin non-owner members
        if (!message.isGroup) return;
        if (isOwner || isGroupAdmin) return;
        if (message.fromMe) return;

        const { from, sender, pushName, type } = message;

        // Check anti-bot setting (cached)
        const groupData = await this.getGroupSettings(from);
        if (!groupData?.antibot) return;

        // Check if message type is bot-only
        if (!BOT_ONLY_TYPES.has(type)) return;

        // Fetch live group metadata to get accurate admin list
        let groupMetadata: any;
        try {
            groupMetadata = await Chisato.groupMetadata(from);
        } catch {
            return;
        }

        const botNumber = await Chisato.decodeJid(Chisato.user?.id);
        const isBotAdmin: string[] = groupMetadata.participants
            ?.filter((v: any) => v.admin !== null && v.admin !== undefined)
            ?.map((v: any) => v.id) ?? [];

        if (!isBotAdmin.includes(botNumber)) {
            logger.info(`Anti-bot (message): skipped — bot is not admin in ${from}`);
            return;
        }

        try {
            // Delete the bot message
            await Chisato.sendMessage(from, {
                delete: message.key,
            });
        } catch {
            // Ignore deletion errors and proceed to kick
        }

        try {
            await Chisato.groupParticipantsUpdate(from, [sender], "remove");

            const caption =
                `*「 ANTI-BOT 」*\n\n` +
                `🤖 @${sender.split("@")[0]} was kicked for sending bot-type messages.\n` +
                `📨 Message type: \`${type}\`\n\n` +
                `_Anti-bot is active in this group._`;

            await Chisato.sendText(from, caption, null, {
                mentions: [sender],
            });

            logger.info(
                `Anti-bot (message): kicked ${sender} (${pushName}) from ${from} — type: ${type}`
            );
        } catch (err) {
            logger.error(
                `Anti-bot (message): failed to kick ${sender} — ${
                    err instanceof Error ? err.message : String(err)
                }`
            );
        }
    }
}
