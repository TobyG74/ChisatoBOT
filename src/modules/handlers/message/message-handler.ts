import { MessageSerialize } from "../../../types/structure/serialize";
import { Client } from "../../../libs/client/client";
import { BotConfig, configService } from "../../../core/config/config.service";
import { logger } from "../../../core/logger/logger.service";
import { MessageContextBuilder } from "./message-context.builder";
import { MessageLogger } from "./message-logger";
import { CommandValidator } from "./command-validator";
import { AfkHandler } from "./afk-handler";
import { EvalExecHandler } from "./eval-exec-handler";
import { SessionHandler } from "./session-handler";
import { commands, cooldowns } from "../../../libs";
import {
    Group as GroupDatabase,
    User as UserDatabase,
} from "../../../libs/database";
import { AntiLinkHandler } from "../settings";
import { StringUtils } from "../../../utils/core/string-utils";
import { formatExample } from "../../../utils";

export class MessageHandler {
    private Database = {
        Group: new GroupDatabase(),
        User: new UserDatabase(),
    };
    private antiLinkHandler = new AntiLinkHandler();

    async handle(Chisato: Client, message: MessageSerialize): Promise<void> {
        try {
            const config = configService.getConfig() as BotConfig;

            // Auto-read status
            if (
                config.settings.autoReadStatus &&
                message.key.remoteJid === "status@broadcast" &&
                Chisato.readMessages
            ) {
                await Chisato.readMessages([message.key]);
            }

            // Ignore status broadcasts and protocol messages
            if (message.key.remoteJid === "status@broadcast") return;
            if (!message.type || message.type === "protocolMessage") return;

            // Auto-read messages
            if (config.settings.autoReadMessage && Chisato.readMessages) {
                await Chisato.readMessages([message.key]);
            }

            // Build message context
            const context = await MessageContextBuilder.build(
                Chisato,
                message,
                config,
                this.Database
            );

            // Get command if exists
            const command = context.cmd
                ? commands.get(context.cmd) ??
                  Array.from(commands.values()).find((v) =>
                      v.alias.find((x) => x.toLowerCase() === context.cmd)
                  )
                : null;

            // Skip own messages in selfbot mode
            if (
                !message.fromMe &&
                config.settings.selfbot &&
                message.body &&
                !message.body.startsWith(config.prefix + "mode")
            ) {
                // In selfbot mode, only process own messages or mode command
                await AfkHandler.handle(
                    Chisato,
                    context,
                    message,
                    this.Database
                );
            } else {
                if (!context) return;

                // Check premium expiry
                await this.checkPremiumExpiry(Chisato, context, message);

                // Handle eval/exec commands
                if (await EvalExecHandler.handle(Chisato, context, message)) {
                    return;
                }

                // Check if user has active adminpanel session
                if (await SessionHandler.handle(Chisato, message, context)) {
                    return; // Session handled, skip normal command processing
                }

                // Log message/command
                if (command) {
                    MessageLogger.logCommand(context, command.name);
                } else if (!message.fromMe) {
                    MessageLogger.logChat(context);
                }

                // Handle commands
                if (command) {
                    await this.handleCommand(
                        Chisato,
                        message,
                        context,
                        command
                    );
                } else if (context.cmd && config.settings.autoCorrect) {
                    // Auto-correct: suggest similar commands
                    await this.suggestSimilarCommands(
                        Chisato,
                        message,
                        context
                    );
                }

                // Handle AFK for non-commands
                await AfkHandler.handle(
                    Chisato,
                    context,
                    message,
                    this.Database
                );

                // Handle group settings
                await this.handleGroupSettings(Chisato, message, context);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Skip logging rate-overlimit errors to prevent spam
            if (errorMessage.includes('rate-overlimit')) {
                return;
            }
            
            logger.error(
                `Message handler error: ${errorMessage}`
            );
        }
    }

    private async checkPremiumExpiry(
        Chisato: Client,
        context: any,
        message: MessageSerialize
    ): Promise<void> {
        if (
            context.userMetadata.role === "premium" &&
            context.userMetadata.expired < Date.now()
        ) {
            await Chisato.sendText(
                context.sender,
                "Your premium has expired!",
                message
            );
            await this.Database.User.update(context.sender, {
                role: "free",
                expired: 0,
            });
        }
    }

    private async handleCommand(
        Chisato: Client,
        message: MessageSerialize,
        context: any,
        command: any
    ): Promise<void> {
        const config = configService.getConfig();

        // Check if should skip
        if (CommandValidator.shouldSkipExecution(context, command)) {
            return;
        }

        // Handle helper flag
        if (/-[Hh](elp)?/.test(context.args[0])) {
            await this.sendCommandHelp(Chisato, context, command, message);
            return;
        }

        // Handle maintenance flag (owner only)
        if (/-[Mm](aintenance)?/.test(context.args[0]) && context.isOwner) {
            await this.toggleMaintenance(Chisato, context, command, message);
            return;
        }

        // Validate command
        const validation = await CommandValidator.validateCommand(
            Chisato,
            message,
            context,
            command
        );
        if (!validation.valid) {
            return;
        }

        // Check cooldown
        if (this.checkCooldown(Chisato, context, command, message)) {
            return;
        }

        // Execute command
        if (typeof command.run === "function") {
            await command.run({
                Chisato,
                prefix: context.prefix,
                command,
                arg: context.arg,
                args: context.args,
                query: context.query,
                body: context.body,
                from: context.from,
                sender: context.sender,
                message,
                blockList: context.blockList,
                botNumber: context.botNumber,
                botName: context.botName,
                isOwner: context.isOwner,
                isGroup: context.isGroup,
                isGroupAdmin: context.isGroupAdmin,
                isGroupOwner: context.isGroupOwner,
                isBotAdmin: context.isBotAdmin,
                Database: this.Database,
                groupName: context.groupName,
                groupDescription: context.groupDescription,
                groupParticipants: context.groupParticipants,
                groupAdmins: context.groupAdmins,
                groupMetadata: context.groupMetadata,
                groupSettingData: context.groupSettingData,
                userMetadata: context.userMetadata,
            });

            // Track adminpanel command calls for session handling
            if (command.name === "adminpanel") {
                SessionHandler.trackAdminPanelCall(context.sender);
            }
        }

        // Update limit
        if (
            context.userMetadata.role !== "premium" &&
            !context.isTeam &&
            config.settings.useLimit &&
            command.limit
        ) {
            await this.Database.User.update(context.sender, {
                limit: context.userMetadata.limit - 1,
            });
        }

        // Set cooldown
        if (
            config.settings.useCooldown &&
            command.cooldown &&
            !context.isPremium &&
            !context.isOwner
        ) {
            cooldowns.set(context.sender + command.name, Date.now());
            setTimeout(
                () => cooldowns.delete(context.sender + command.name),
                command.cooldown * 1000
            );
        }
    }

    private checkCooldown(
        Chisato: Client,
        context: any,
        command: any,
        message: MessageSerialize
    ): boolean {
        const config = configService.getConfig();

        if (!config.settings.useCooldown || !command.cooldown) {
            return false;
        }

        if (cooldowns.has(context.sender + command.name)) {
            const remaining =
                (Date.now() - cooldowns.get(context.sender + command.name)!) /
                1000;
            Chisato.sendText(
                context.from,
                `Sorry, please wait ${remaining.toFixed(
                    1
                )} seconds to use this command again`,
                message
            );
            return true;
        }

        return false;
    }

    private async sendCommandHelp(
        Chisato: Client,
        context: any,
        command: any,
        message: MessageSerialize
    ): Promise<void> {
        const config = configService.getConfig();
        let str =
            `*「 HELPER 」*\n\n` +
            `• Name : ${command.name}\n` +
            `• Alias : ${command.alias
                .map((e: string) => e.toString())
                .join(", ")}\n` +
            `• Category : ${command.category}\n` +
            `• Description : ${command.description}\n`;

        if (configService.isMaintenance(command.name)) {
            str += `• Maintenance : true\n`;
        }

        if (command.usage) {
            str += `• Usage : ${command.usage}\n`;
        }

        if (command.example) {
            const formattedExample = formatExample(command.example, {
                prefix: context.prefix,
                command: { name: command.name, alias: command.alias },
                botName: context.botName,
                pushName: context.pushName,
                context: context
            });
            
            str += `• Example : \n${formattedExample}`;
        }

        await Chisato.sendText(context.from, str, message);
    }

    private async toggleMaintenance(
        Chisato: Client,
        context: any,
        command: any,
        message: MessageSerialize
    ): Promise<void> {
        if (configService.isMaintenance(command.name)) {
            configService.removeMaintenance(command.name);
            await Chisato.sendText(
                context.from,
                `*「 MAINTENANCE 」*\n\n${command.name} is now Online!`,
                message
            );
        } else {
            configService.addMaintenance(command.name);
            await Chisato.sendText(
                context.from,
                `*「 MAINTENANCE 」*\n\n${command.name} is now Maintenance!`,
                message
            );
        }
    }

    private async suggestSimilarCommands(
        Chisato: Client,
        message: MessageSerialize,
        context: any
    ): Promise<void> {
        // Get all command names and aliases
        const allCommands: string[] = [];
        commands.forEach((cmd) => {
            allCommands.push(cmd.name);
            if (cmd.alias && cmd.alias.length > 0) {
                allCommands.push(...cmd.alias);
            }
        });

        // Find similar commands (threshold 60%, max 3 results)
        const similar = StringUtils.findSimilar(
            context.cmd.toLowerCase(),
            allCommands,
            60,
            3
        );

        // If found similar commands, send suggestion
        if (similar.length > 0) {
            let suggestionText = `*「 AUTO CORRECT 」*\n\n` 
            suggestionText += `• Command *${context.cmd}* not found.\n`;
            suggestionText += `└ *Did you mean:*\n`;

            similar.forEach((item, index) => {
                suggestionText += `${index + 1}. ${context.prefix}${
                    item.text
                } (${item.similarity.toFixed(0)}% match)\n`;
            });

            suggestionText += `\n💡 Type ${context.prefix}menu to see all commands`;

            await Chisato.sendText(context.from, suggestionText, message);
        }
    }

    private async handleGroupSettings(
        Chisato: Client,
        message: MessageSerialize,
        context: any
    ): Promise<void> {
        if (!context.isGroup || !context.isBotAdmin) return;

        // Handle anti-link
        await this.antiLinkHandler.handle(
            Chisato,
            message,
            context.isOwner,
            context.isGroupAdmin
        );
    }
}
