import { logger } from "../../../core/logger/logger.service";

export class MessageLogger {
    static logCommand(context: MessageContext, commandName: string): void {
        if (context.isBlock || context.isBanned) {
            logger.command({
                pushName: context.pushName,
                groupName: context.groupName,
                commandName,
            });
            return;
        }

        if (context.isMute && commandName !== "unmute") {
            logger.mute({
                pushName: context.pushName,
                groupName: context.groupName,
                commandName,
            });
            return;
        }

        logger.command({
            pushName: context.pushName,
            groupName: context.groupName,
            commandName,
        });
    }

    static logChat(context: MessageContext): void {
        // Skip eval and exec commands
        if (
            context.body &&
            (context.body.startsWith(">> ") || context.body.startsWith("$ "))
        ) {
            return;
        }

        logger.chat({
            pushName: context.pushName,
            groupName: context.groupName,
            body: context.body,
        });
    }
}
