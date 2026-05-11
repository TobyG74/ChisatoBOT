import { MessageSerialize } from "../../../types/structure/serialize";
import { logger } from "../../../core/logger/logger.service";
import * as Libs from "../../../libs";
import { MessageContextBuilder } from "./message-context.builder";

export class AfkHandler {
    static async handle(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
        if (message.fromMe) return;

        // Check if user is AFK and returning
        if (context.userMetadata?.afk?.status && context.isGroup) {
            await this.handleUserReturn(Chisato, context, message, Database);
            return;
        }

        // Check mentions for AFK users
        if (
            message.mentions &&
            message.mentions.length > 0 &&
            context.isGroup
        ) {
            await this.handleAfkMentions(Chisato, context, message, Database);
        }

        // Check quoted message for AFK user
        if (message.quoted && context.isGroup) {
            await this.handleAfkQuoted(Chisato, context, message, Database);
        }
    }

    private static async handleUserReturn(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
        const afkData = context.userMetadata?.afk;
        const since = afkData?.since && Libs.getRemaining(afkData.since);

        await Chisato.sendMessage(
            context.from,
            {
                text: `*「 AFK 」*\n\n@${
                    context.sender.split("@")[0]
                } has been back from AFK since ${since}`,
                mentions: [context.sender],
            },
            { quoted: message }
        );

        await Database.User.update(context.sender, {
            afk: { status: false, reason: null, since: 0 },
        });
        // Invalidate cache so the next message reads updated DB data (prevents re-triggering return)
        MessageContextBuilder.invalidateUser(context.sender);
    }

    private static async handleAfkMentions(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
        const mentions = message.mentions.filter(m => m !== context.botNumber);
        if (mentions.length === 0) return;

        // Fetch all mentioned users' data in parallel instead of serial loop
        const afkUsers = await Promise.all(mentions.map(m => Database.User.get(m)));

        for (let i = 0; i < mentions.length; i++) {
            const mention = mentions[i];
            const afkData = afkUsers[i]?.afk;

            if (afkData?.status) {
                const since = afkData?.since && Libs.getRemaining(afkData.since);
                const reason = afkData?.reason || "No reason";

                await Chisato.sendMessage(
                    context.from,
                    {
                        text: `*「 AFK 」*\n\n@${
                            mention.split("@")[0]
                        } is AFK\nSince : ${since}\nReason : ${reason}`,
                        mentions: [mention],
                    },
                    { quoted: message }
                );
                break;
            }
        }
    }

    private static async handleAfkQuoted(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
        if (!message.quoted?.sender) return;

        const afkUser = await Database.User.get(message.quoted.sender);
        const afkData = afkUser?.afk;

        if (afkData?.status) {
            const since = afkData?.since && Libs.getRemaining(afkData.since);
            const reason = afkData?.reason || "No reason";

            await Chisato.sendMessage(
                context.from,
                {
                    text: `*「 AFK 」*\n\n@${
                        message.quoted.sender.split("@")[0]
                    } is AFK\nSince : ${since}\nReason : ${reason}`,
                    mentions: [message.quoted.sender],
                },
                { quoted: message }
            );
        }
    }
}
