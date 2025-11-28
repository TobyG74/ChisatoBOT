import "dotenv/config";
import Pino from "pino";
import util from "util";
import { Client } from "../libs/client/client";
import { setClientInstance } from "../libs/client/instance";
import * as serialize from "../libs/serialize";
import { MessageHandler } from "../modules/handlers/message";
import { GroupUpdateHandler } from "../modules/handlers/group";
import { AntiCallHandler } from "../modules/handlers/settings";
import { logger } from "../core/logger";
import { configService } from "../core/config";
import { databaseService } from "../infrastructure/database";
import { DashboardServer } from "../dashboard/server";

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
        logger.connect(
            `Dashboard server started on http://localhost:${dashboardPort}`
        );

        // Create handler instances
        const messageHandler = new MessageHandler();
        const groupUpdateHandler = new GroupUpdateHandler();
        const antiCallHandler = new AntiCallHandler();

        // Initialize client
        const Chisato = new Client({
            session: "multi",
            syncFullHistory: false,
            browser: ["ChisatoBOT", "Safari", "3.0.0"],
            logger: Pino({ level: "silent" }).child({ level: "silent" }),
        });

        // Set client instance for global access
        setClientInstance(Chisato);

        // Connect to WhatsApp
        await Chisato.connect();

        // Handle messages with new clean architecture
        Chisato.on("messages.upsert", async (message) => {
            try {
                if (!message?.message) return;
                if (message.key.remoteJid === "status@broadcast") return;
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
        process.on("unhandledRejection", (reason, promise) => {
            logger.error(
                `Unhandled Rejection at: ${promise}, reason: ${reason}`
            );
        });

        // Uncaught exception handler
        process.on("uncaughtException", (error) => {
            logger.error(`Uncaught Exception: ${util.inspect(error)}`);
            logger.error(error.stack || "");
        });

        logger.connect("All event handlers registered successfully");
    } catch (error) {
        logger.error(
            `Initialization error: ${
                error instanceof Error ? util.inspect(error) : String(error)
            }`
        );
        process.exit(1);
    }
})();
