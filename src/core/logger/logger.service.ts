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

    private formatMessage(
        level: LogLevel,
        message: string,
        secondaryMessage?: string
    ): string {
        const levelColor = this.getLevelColor(level);
        const timestamp = this.getTimestamp();

        const parts = [
            clc.green.bold("["),
            levelColor(level),
            clc.green.bold("]"),
        ];

        if (level !== LogLevel.CONNECT) {
            parts.push(clc.blue(timestamp));
        }

        parts.push(clc.green(message));

        if (secondaryMessage) {
            parts.push(clc.yellow.bold(secondaryMessage));
        }

        return parts.join(" ");
    }

    private getLevelColor(level: LogLevel): (text: string) => string {
        switch (level) {
            case LogLevel.ERROR:
                return clc.red.bold;
            case LogLevel.EVAL:
            case LogLevel.EXEC:
                return clc.magenta.bold;
            case LogLevel.COMMAND:
            case LogLevel.MUTE:
                return clc.yellow.bold;
            case LogLevel.CHAT:
                return clc.cyan.bold;
            default:
                return clc.yellow.bold;
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

    public error(message: string): void {
        console.log(this.formatMessage(LogLevel.ERROR, message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.ERROR, message);
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
        console.log(clc.green.bold("[ ! ]"), clc.blue(message));
        if (addDashboardLog) {
            addDashboardLog(LogLevel.CONNECT, message);
        }
    }

    public command(context: LogContext): void {
        const { pushName, groupName, commandName } = context;

        if (groupName) {
            console.log(
                clc.green.bold("["),
                clc.yellow.bold("CMDS"),
                clc.green.bold("]"),
                clc.blue(this.getTimestamp()),
                "from",
                clc.magenta.bold(pushName || "Unknown"),
                "in",
                clc.yellow.bold(groupName),
                "|",
                clc.green.bold(commandName || "")
            );
            if (addDashboardLog) {
                addDashboardLog(LogLevel.COMMAND, `from ${pushName || "Unknown"} in ${groupName} | ${commandName || ""}`, context);
            }
        } else {
            console.log(
                clc.green.bold("["),
                clc.yellow.bold("CMDS"),
                clc.green.bold("]"),
                clc.blue(this.getTimestamp()),
                "from",
                clc.magenta.bold(pushName || "Unknown"),
                "|",
                clc.green.bold(commandName || "")
            );
            if (addDashboardLog) {
                addDashboardLog(LogLevel.COMMAND, `from ${pushName || "Unknown"} | ${commandName || ""}`, context);
            }
        }
    }

    public chat(context: LogContext): void {
        const { pushName, groupName, body } = context;
        const truncatedBody = body ? body.replace(/\n/g, " ").slice(0, 50) : "";

        if (groupName) {
            console.log(
                clc.green.bold("["),
                clc.cyan.bold("CHAT"),
                clc.green.bold("]"),
                clc.blue(this.getTimestamp()),
                "from",
                clc.magenta.bold(pushName || "Unknown"),
                "in",
                clc.yellow.bold(groupName),
                "|",
                clc.green.bold(truncatedBody)
            );
            if (addDashboardLog) {
                addDashboardLog(LogLevel.CHAT, `from ${pushName || "Unknown"} in ${groupName} | ${truncatedBody}`, context);
            }
        } else {
            console.log(
                clc.green.bold("["),
                clc.cyan.bold("CHAT"),
                clc.green.bold("]"),
                clc.blue(this.getTimestamp()),
                "from",
                clc.magenta.bold(pushName || "Unknown"),
                "|",
                clc.green.bold(truncatedBody)
            );
            if (addDashboardLog) {
                addDashboardLog(LogLevel.CHAT, `from ${pushName || "Unknown"} | ${truncatedBody}`, context);
            }
        }
    }

    public mute(context: LogContext): void {
        const { pushName, groupName, commandName } = context;
        console.log(
            clc.green.bold("["),
            clc.yellow.bold("MUTE"),
            clc.green.bold("]"),
            clc.blue(this.getTimestamp()),
            "from",
            clc.magenta.bold(pushName || "Unknown"),
            "in",
            clc.yellow.bold(groupName || ""),
            "|",
            clc.green.bold(commandName || "")
        );
        if (addDashboardLog) {
            addDashboardLog(LogLevel.MUTE, `from ${pushName || "Unknown"} in ${groupName || ""} | ${commandName || ""}`, context);
        }
    }
}

export const logger = LoggerService.getInstance();
