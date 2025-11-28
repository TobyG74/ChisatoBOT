/**
 * Optimized Command Loader with Lazy Loading
 * Commands are loaded on-demand instead of all at once
 */

import fs from "fs";
import path from "path";
import { logger } from "../../core/logger/logger.service";
import type { ConfigCommands } from "../../types/structure/commands";

interface CommandCache {
    command: ConfigCommands;
    lastModified: number;
}

class CommandLoader {
    private static instance: CommandLoader;
    private commandsCache: Map<string, CommandCache> = new Map();
    private commandPaths: Map<string, string> = new Map();
    private aliasMap: Map<string, string> = new Map();
    private watchingFiles: Set<string> = new Set();

    private constructor() {
        this.scanCommands();
    }

    public static getInstance(): CommandLoader {
        if (!CommandLoader.instance) {
            CommandLoader.instance = new CommandLoader();
        }
        return CommandLoader.instance;
    }

    /**
     * Scan command directories and build index
     */
    private scanCommands(): void {
        const commandsDir = path.join(process.cwd(), "dist", "commands");

        if (!fs.existsSync(commandsDir)) {
            logger.error("Commands directory not found");
            return;
        }

        const categories = fs.readdirSync(commandsDir);
        let totalCommands = 0;

        for (const category of categories) {
            const categoryPath = path.join(commandsDir, category);
            const stat = fs.statSync(categoryPath);

            if (!stat.isDirectory()) continue;

            const files = fs
                .readdirSync(categoryPath)
                .filter((f) => f.endsWith(".js"));

            for (const file of files) {
                const filePath = path.join(categoryPath, file);
                const commandName = file.replace(".js", "");

                this.commandPaths.set(commandName, filePath);
                totalCommands++;
            }
        }

        logger.connect(
            `Indexed ${totalCommands} commands (lazy loading enabled)`
        );
    }

    /**
     * Get command by name (lazy load if not in cache)
     */
    public async getCommand(name: string): Promise<ConfigCommands | null> {
        const actualName = this.aliasMap.get(name) || name;

        const cached = this.commandsCache.get(actualName);
        if (cached) {
            return cached.command;
        }

        const filePath = this.commandPaths.get(actualName);
        if (!filePath) {
            return null;
        }

        try {
            delete require.cache[require.resolve(filePath)];

            const commandModule = await import(filePath);
            const command: ConfigCommands = commandModule.default;

            const stats = fs.statSync(filePath);
            this.commandsCache.set(actualName, {
                command,
                lastModified: stats.mtimeMs,
            });

            if (command.alias) {
                for (const alias of command.alias) {
                    this.aliasMap.set(alias.toLowerCase(), actualName);
                }
            }

            if (!this.watchingFiles.has(filePath)) {
                this.watchFile(filePath, actualName);
            }

            return command;
        } catch (error) {
            logger.error(
                `Failed to load command ${actualName}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return null;
        }
    }

    /**
     * Watch command file for changes (hot reload)
     */
    private watchFile(filePath: string, commandName: string): void {
        this.watchingFiles.add(filePath);

        fs.watch(filePath, async (eventType) => {
            if (eventType === "change") {
                logger.info(`Command ${commandName} updated, reloading...`);

                this.commandsCache.delete(commandName);

                for (const [alias, name] of this.aliasMap.entries()) {
                    if (name === commandName) {
                        this.aliasMap.delete(alias);
                    }
                }

            }
        });
    }

    /**
     * Get all commands (for menu)
     */
    public async getAllCommands(): Promise<ConfigCommands[]> {
        const commands: ConfigCommands[] = [];

        for (const [name] of this.commandPaths) {
            const command = await this.getCommand(name);
            if (command) {
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Get command categories
     */
    public async getCategories(): Promise<Map<string, ConfigCommands[]>> {
        const categories = new Map<string, ConfigCommands[]>();
        const allCommands = await this.getAllCommands();

        for (const command of allCommands) {
            const category = command.category || "other";

            if (!categories.has(category)) {
                categories.set(category, []);
            }

            categories.get(category)!.push(command);
        }

        return categories;
    }

    /**
     * Get cache stats
     */
    public getStats(): { cached: number; total: number; hitRate: string } {
        const cached = this.commandsCache.size;
        const total = this.commandPaths.size;
        const hitRate =
            total > 0 ? ((cached / total) * 100).toFixed(2) : "0.00";

        return { cached, total, hitRate: `${hitRate}%` };
    }

    /**
     * Clear cache
     */
    public clearCache(): void {
        this.commandsCache.clear();
        this.aliasMap.clear();
        logger.info("Command cache cleared");
    }

    /**
     * Preload commonly used commands
     */
    public async preloadCommands(commandNames: string[]): Promise<void> {
        logger.info(`Preloading ${commandNames.length} commands...`);

        await Promise.all(commandNames.map((name) => this.getCommand(name)));

        logger.connect("Command preload completed");
    }
}

export const commandLoader = CommandLoader.getInstance();
