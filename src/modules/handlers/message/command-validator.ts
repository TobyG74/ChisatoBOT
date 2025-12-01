import { configService } from "../../../core/config/config.service";
import { formatExample } from "../../../utils";

export class CommandValidator {
    static async validateCommand(
        Chisato: any,
        message: any,
        context: MessageContext,
        command: any
    ): Promise<{ valid: boolean; reason?: string }> {
        const config = configService.getConfig();

        // Check maintenance
        if (configService.isMaintenance(command.name) && !context.isOwner) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, this command is currently under Maintenance!",
                message
            );
            return { valid: false, reason: "maintenance" };
        }

        // Check limit
        if (command.limit && context.isLimit && config.settings.useLimit) {
            await Chisato.sendText(
                context.from,
                "Sorry, you've reached your limit today. Please try again tomorrow",
                message
            );
            return { valid: false, reason: "limit" };
        }

        // Check example requirement
        if (command.example && context.args.length === 0) {
            const formattedExample = formatExample(command.example, {
                prefix: context.prefix,
                command: { name: command.name, alias: command.alias },
                botName: context.botName,
                pushName: context.pushName,
                context: context
            });
            
            await Chisato.sendText(
                context.from,
                formattedExample,
                message
            );
            return { valid: false, reason: "example_required" };
        }

        // Check owner permission
        if (command.isOwner && !context.isOwner) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, This command can only be used by the Bot Owner!",
                message
            );
            return { valid: false, reason: "owner_only" };
        }

        // Check group requirement
        if (command.isGroup && !context.isGroup) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, This command can only be used in Groups!",
                message
            );
            return { valid: false, reason: "group_only" };
        }

        // Check private requirement
        if (command.isPrivate && context.isGroup) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, this command can only be used in private message!",
                message
            );
            return { valid: false, reason: "private_only" };
        }

        // Check premium requirement
        if (command.isPremium && !(context.isPremium || context.isTeam)) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, This command can only be used by Premium Users!",
                message
            );
            return { valid: false, reason: "premium_only" };
        }

        // Check group admin permission
        if (command.isGroupAdmin && !(context.isGroupAdmin || context.isTeam)) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, This command can only be used by Group Admins!",
                message
            );
            return { valid: false, reason: "admin_only" };
        }

        // Check group owner permission
        if (command.isGroupOwner && !(context.isGroupOwner || context.isTeam)) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, This command can only be used by Group Owner!",
                message
            );
            return { valid: false, reason: "owner_only" };
        }

        // Check bot admin requirement
        if (command.isBotAdmin && !context.isBotAdmin) {
            await Chisato.sendText(
                context.from,
                "*「 ! 」* Sorry, Bots are not Group Admins! Make Bot as Group Admin for command to work!",
                message
            );
            return { valid: false, reason: "bot_not_admin" };
        }

        return { valid: true };
    }

    static shouldSkipExecution(context: MessageContext, command: any): boolean {
        // Skip if blocked or banned
        if (context.isBlock || context.isBanned) {
            return true;
        }

        // Skip if muted (except unmute command)
        if (
            context.isMute &&
            command.name !== "unmute" &&
            !(context.isGroupAdmin || context.isOwner)
        ) {
            return true;
        }

        return false;
    }
}
