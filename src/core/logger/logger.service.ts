import clc from "cli-color";
import moment from "moment-timezone";
import { configService } from "../config/config.service";

// Import dashboard log function
let addDashboardLog: ((level: string, message: string, metadata?: any) => void) | null = null;

// Export function to set dashboard log handler
export function setDashboardLogHandler(handler: (level: string, message: string, metadata?: any) => void): void {
    addDashboardLog = handler;
}

export enum LogLevel {
    STATUS = "STATUS",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    EVAL = "EVAL",
    EXEC = "EXEC",
    CONNECT = "CONNECT",
    COMMAND = "CMDS",
    CHAT = "CHAT",
    MUTE = "MUTE",
}

export interface LogContext {
    pushName?: string;
    groupName?: string;
    commandName?: string;
    body?: string;
}

class LoggerService {
    private static instance: LoggerService;
    private timezone: string;

    private constructor() {
        this.timezone = configService.get("timeZone") || "Asia/Jakarta";
        moment.tz.setDefault(this.timezone);
    }

    public static getInstance(): LoggerService {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }

    private getTimestamp(): string {
        return moment().format("DD/MM HH:mm:ss");
    }

    private ts(): string {
        return clc.blackBright(this.getTimestamp());
    }

    private pill(label: string, bg: (s: string) => string): string {
        return bg(` ${label} `);
    }

    private formatMessage(
        level: LogLevel,
        message: string,
        secondaryMessage?: string
    ): string {
        const ts = this.ts();
        const badge = this.getLevelBadge(level);
        const parts = [ts, badge, clc.whiteBright(message)];
        if (secondaryMessage) parts.push(clc.yellow(secondaryMessage));
        return parts.join(" ");
    }

    private getLevelBadge(level: LogLevel): string {
        switch (level) {
            case LogLevel.ERROR:   return clc.bgRed.white.bold(" ERROR  ");
            case LogLevel.WARN:    return clc.bgYellow.black.bold("  WARN  ");
            case LogLevel.EVAL:
            case LogLevel.EXEC:   return clc.bgMagenta.white.bold(`  ${level}  `);
            case LogLevel.COMMAND: return clc.bgYellow.black.bold("  CMDS  ");
            case LogLevel.CHAT:   return clc.bgCyan.black.bold("  CHAT  ");
            case LogLevel.MUTE:   return clc.bgYellow.black.bold("  MUTE  ");
            case LogLevel.STATUS: return clc.bgYellow.black.bold(" STATUS ");
            case LogLevel.CONNECT:return clc.bgGreen.black.bold("  CONN  ");
            case LogLevel.INFO:
            default:              return clc.bgBlue.black.bold("  INFO  ");
        }
    }

    public status(message: string, statusCode?: string): void {
        console.log(
            this.formatMessage(LogLevel.STATUS, statusCode || "", message)
        );
        if (addDashboardLog) {
            addDashboardLog(LogLevel.STATUS, `${statusCode || ""} ${message}`);
        }
    }

    public info(message: string): void {
        console.log(this.formatMessage(LogLevel.INFO, message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.INFO, message);
        }
    }

    public warn(message: string): void {
        console.log(this.formatMessage(LogLevel.WARN, message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.WARN, message);
        }
    }

    public error(message: string, error?: any): void {
        console.log(this.formatMessage(LogLevel.ERROR, message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.ERROR, message, error instanceof Error ? { message: error.message, stack: error.stack } : error);
        }
    }

    public eval(code: string): void {
        const truncatedCode = code.replace(/\n/g, " ").slice(0, 50);
        console.log(this.formatMessage(LogLevel.EVAL, truncatedCode));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.EVAL, truncatedCode);
        }
    }

    public exec(command: string): void {
        const truncatedCommand = command.replace(/\n/g, " ").slice(0, 50);
        console.log(this.formatMessage(LogLevel.EXEC, truncatedCommand));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.EXEC, truncatedCommand);
        }
    }

    public connect(message: string): void {
        console.log(this.ts(), clc.bgGreen.black.bold("  CONN  "), clc.greenBright(message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.CONNECT, message);
        }
    }

    public command(context: LogContext): void {
        const { pushName, groupName, commandName } = context;
        const where = groupName
            ? `${clc.magentaBright(pushName || "Unknown")} in ${clc.yellow(groupName)}`
            : clc.magentaBright(pushName || "Unknown");
        console.log(
            this.ts(),
            clc.bgYellow.black.bold("  CMDS  "),
            `${where} ${clc.blackBright("→")} ${clc.greenBright(commandName || "")}`
        );
        if (addDashboardLog) {
            addDashboardLog(LogLevel.COMMAND, `from ${pushName || "Unknown"}${groupName ? ` in ${groupName}` : ""} | ${commandName || ""}`, context);
        }
    }

    public chat(context: LogContext): void {
        const { pushName, groupName, body } = context;
        const truncatedBody = body ? body.replace(/\n/g, " ").slice(0, 50) : "";
        const where = groupName
            ? `${clc.magentaBright(pushName || "Unknown")} in ${clc.yellow(groupName)}`
            : clc.magentaBright(pushName || "Unknown");
        console.log(
            this.ts(),
            clc.bgCyan.black.bold("  CHAT  "),
            `${where} ${clc.blackBright("│")} ${clc.whiteBright(truncatedBody)}`
        );
        if (addDashboardLog) {
            addDashboardLog(LogLevel.CHAT, `from ${pushName || "Unknown"}${groupName ? ` in ${groupName}` : ""} | ${truncatedBody}`, context);
        }
    }

    public mute(context: LogContext): void {
        const { pushName, groupName, commandName } = context;
        console.log(
            this.ts(),
            clc.bgYellow.black.bold("  MUTE  "),
            `${clc.magentaBright(pushName || "Unknown")} in ${clc.yellow(groupName || "")} ${clc.blackBright("→")} ${clc.greenBright(commandName || "")}`
        );
        if (addDashboardLog) {
            addDashboardLog(LogLevel.MUTE, `from ${pushName || "Unknown"} in ${groupName || ""} | ${commandName || ""}`, context);
        }
    }
}

export const logger = LoggerService.getInstance();
