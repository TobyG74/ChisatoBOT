import { MessageSerialize } from "../../../types/structure/serialize";
import { logger } from "../../../core/logger/logger.service";
import * as Libs from "../../../libs";

export class AfkHandler {
    static async handle(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
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
    }

    private static async handleAfkMentions(
        Chisato: any,
        context: MessageContext,
        message: MessageSerialize,
        Database: any
    ): Promise<void> {
        for (const mention of message.mentions) {
            const afkUser = await Database.User.get(mention);
            const afkData = afkUser?.afk;

            if (afkData?.status) {
                const since =
                    afkData?.since && Libs.getRemaining(afkData.since);
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
