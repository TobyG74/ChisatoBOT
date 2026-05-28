import "dotenv/config";
import Pino from "pino";
import util from "util";

// Suppress verbose libsignal noise on stdout/stderr.
const _origInfo = console.info.bind(console);
const _origWarn = console.warn.bind(console);
const _origError = console.error.bind(console);

const LIBSIGNAL_NOISE_PREFIXES = [
    "Closing session",
    "Closing open session",
    "Removing old closed session",
    "Decrypted message with closed session",
    "Failed to decrypt message with closed session",
    "Failed to decrypt message with any known session",
    "Session error:",
];

const isLibsignalNoise = (args: unknown[]): boolean =>
    typeof args[0] === "string" &&
    LIBSIGNAL_NOISE_PREFIXES.some((p) => (args[0] as string).startsWith(p));

console.info = (...args: unknown[]) => {
    if (isLibsignalNoise(args)) return;
    _origInfo(...args);
};
console.warn = (...args: unknown[]) => {
    if (isLibsignalNoise(args)) return;
    _origWarn(...args);
};
console.error = (...args: unknown[]) => {
    if (isLibsignalNoise(args)) return;
    _origError(...args);
};

import { Client } from "../libs/client/client";
import { setClientInstance } from "../libs/client/instance";
import * as serialize from "../libs/serialize";
import { MessageHandler } from "../modules/handlers/message";
import { GroupUpdateHandler } from "../modules/handlers/group";
import { AntiCallHandler, AntiDeleteHandler, antiDeleteCache } from "../modules/handlers/settings";
import { logger } from "../core/logger";
import { configService } from "../core/config";
import { databaseService } from "../infrastructure/database";
import { DashboardServer } from "../dashboard/server";
import { warmupGiSupplement } from "../utils/scrapers/lookup/enka-gi.scraper";
import { initUptime, startMemoryMonitor } from "../core/runtime";

// boot time across auto-restarts (e.g. memory-triggered restarts).
initUptime();

// Initialize services
logger.connect("Initializing ChisatoBOT v2.0...");

// Validate configuration
try {
    const config = configService.getConfig();
    logger.connect("Configuration loaded successfully");
} catch (error) {
    logger.error(
        `Configuration error: ${
            error instanceof Error ? util.inspect(error) : String(error)
        }`
    );
    process.exit(1);
}

// Initialize database
logger.connect("Connecting to database...");

(async () => {
    try {
        // Start dashboard server
        const dashboardPort = process.env.DASHBOARD_PORT
            ? parseInt(process.env.DASHBOARD_PORT)
            : 3000;
        const dashboard = new DashboardServer(dashboardPort);
        await dashboard.start();

        // Create handler instances
        const messageHandler = new MessageHandler();
        const groupUpdateHandler = new GroupUpdateHandler();
        const antiCallHandler = new AntiCallHandler();
        const antiDeleteHandler = new AntiDeleteHandler();

        // Initialize client
        const Chisato = new Client({
            session: "multi",
            syncFullHistory: false,
            browser: ['Mac OS', 'Chrome', 'Chrome 114.0.5735.198'],
            logger: Pino({ level: "silent" }).child({ level: "silent" }),
        });

        // Set client instance for global access
        setClientInstance(Chisato);

        // Connect to WhatsApp
        await Chisato.connect();

        // Pre-warm Genshin/Enka supplement bundle in the background.
        warmupGiSupplement()
            .then(() => logger.connect("Enka supplement cache ready"))
            .catch((err) =>
                logger.warn(
                    `Enka supplement warmup failed (non-fatal): ${
                        err instanceof Error ? err.message : String(err)
                    }`
                )
            );

        // Handle messages with new clean architecture
        Chisato.on("messages.upsert", async (message) => {
            try {
                if (!message?.message) return;
                if (message.key.remoteJid === "status@broadcast") return;

                // Populate the anti-delete cache for group messages that aren't
                if (
                    message.key.remoteJid?.endsWith("@g.us") &&
                    !message.key.fromMe &&
                    !message.messageStubType &&
                    !message.message.protocolMessage &&
                    !message.message.reactionMessage &&
                    !message.message.pollUpdateMessage &&
                    !message.message.senderKeyDistributionMessage
                ) {
                    const msg = message;
                    queueMicrotask(() => antiDeleteCache.put(msg));
                }

                const serialized = await serialize.message(
                    Chisato,
                    message as any
                );
                await messageHandler.handle(Chisato, serialized);
            } catch (error) {
                logger.error(
                    `Message handling error: ${
                        error instanceof Error ? util.inspect(error) : String(error)
                    }`
                );
            }
        });

        // Handle group updates
        Chisato.on("group.update", async (update) => {
            try {
                const serialized = await serialize.group(update as any);
                await groupUpdateHandler.handle(Chisato, serialized);
            } catch (error) {
                logger.error(
                    `Group update error: ${
                        error instanceof Error ? util.inspect(error) : String(error)
                    }`
                );
            }
        });

        // Handle real-time participant add/remove/promote/demote (faster than stub-based)
        Chisato.on("group-participants.update", async (update) => {
            try {
                await groupUpdateHandler.handleParticipantsUpdate(Chisato, update);
            } catch (error) {
                logger.error(
                    `Group participants update error: ${
                        error instanceof Error ? util.inspect(error) : String(error)
                    }`
                );
            }
        });

        // Handle calls
        Chisato.on("call", async (call) => {
            try {
                await antiCallHandler.handle(Chisato, call);
            } catch (error) {
                logger.error(
                    `Call handler error: ${
                        error instanceof Error ? util.inspect(error) : String(error)
                    }`
                );
            }
        });

        // Handle delete-for-everyone (anti-delete)
        Chisato.on("messages.revoke", async (revoke) => {
            try {
                await antiDeleteHandler.handle(Chisato, revoke);
            } catch (error) {
                logger.error(
                    `Anti-delete handler error: ${
                        error instanceof Error ? util.inspect(error) : String(error)
                    }`
                );
            }
        });

        // Graceful shutdown
        process.on("SIGINT", async () => {
            logger.info("Shutting down gracefully...");
            await databaseService.disconnect();
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            logger.info("Shutting down gracefully...");
            await databaseService.disconnect();
            process.exit(0);
        });

        // Unhandled rejection handler
        process.on("unhandledRejection", (reason, _promise) => {
            logger.error(
                `Unhandled Rejection: ${reason instanceof Error ? reason.message : String(reason)}`
            );
        });

        // Uncaught exception handler
        process.on("uncaughtException", (error) => {
            logger.error(`Uncaught Exception: ${util.inspect(error)}`);
            logger.error(error.stack || "");
        });

        logger.connect("All event handlers registered successfully");

        // Memory watchdog: restart the process if RSS stays above 1 GB for two
        // consecutive 30 s samples. Uptime is preserved via the heartbeat file
        // so users see a continuous runtime even after the restart. Requires
        // PM2 (or another supervisor) to actually relaunch the process.
        startMemoryMonitor({
            threshold: 1024 * 1024 * 1024,    // 1 GB
            interval: 30_000,
            sustainedSamples: 2,
            onBeforeRestart: async () => {
                try { await databaseService.disconnect(); } catch { /* ignore */ }
            },
        });
    } catch (error) {
        logger.error(
            `Initialization error: ${
                error instanceof Error ? util.inspect(error) : String(error)
            }`
        );
        process.exit(1);
    }
})();
