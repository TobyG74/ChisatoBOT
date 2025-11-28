import fs from "fs";
import path from "path";

export interface BotConfig {
    ownerNumber: string[];
    teamNumber: string[];
    timeZone: string;
    prefix: string;
    maintenance: string[];
    stickers: {
        author: string;
        packname: string;
    };
    settings: {
        ownerNotifyOnline: boolean;
        useLimit: boolean;
        useCooldown: boolean;
        selfbot: boolean;
        autoReadMessage: boolean;
        autoReadStatus: boolean;
        autoCorrect: boolean;
    };
    call: {
        status: string;
    };
    limit: {
        command: number;
    };
    cfonts: Record<string, any>;
}

class ConfigService {
    private static instance: ConfigService;
    private config: BotConfig;
    private configPath: string;

    private constructor() {
        this.configPath = path.join(process.cwd(), "config.json");
        this.loadConfig();
    }

    public static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    private loadConfig(): void {
        try {
            const configData = fs.readFileSync(this.configPath, "utf-8");
            this.config = JSON.parse(configData);
            this.validateConfig();
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load config: ${errorMessage}`);
        }
    }

    private validateConfig(): void {
        if (!this.config.prefix) {
            throw new Error("Config validation failed: prefix is required");
        }
        if (!this.config.timeZone) {
            throw new Error("Config validation failed: timeZone is required");
        }
    }

    public getConfig(): BotConfig {
        this.loadConfig();
        return this.config;
    }

    public get<K extends keyof BotConfig>(key: K): BotConfig[K] {
        return this.config[key];
    }

    public updateConfig(updates: Partial<BotConfig>): void {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }

    public addMaintenance(commandName: string): void {
        if (!this.config.maintenance.includes(commandName)) {
            this.config.maintenance.push(commandName);
            this.saveConfig();
        }
    }

    public removeMaintenance(commandName: string): void {
        const index = this.config.maintenance.indexOf(commandName);
        if (index !== -1) {
            this.config.maintenance.splice(index, 1);
            this.saveConfig();
        }
    }

    public isMaintenance(commandName: string): boolean {
        return this.config.maintenance.includes(commandName);
    }

    public updateSettings(updates: Partial<BotConfig["settings"]>): void {
        this.config.settings = { ...this.config.settings, ...updates };
        this.saveConfig();
    }

    private saveConfig(): void {
        try {
            fs.writeFileSync(
                this.configPath,
                JSON.stringify(this.config, null, 4)
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save config: ${errorMessage}`);
        }
    }

    public reload(): void {
        this.loadConfig();
    }
}

export const configService = ConfigService.getInstance();
