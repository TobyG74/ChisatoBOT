import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import { statsRoutes } from "./routes/stats";
import { groupsRoutes } from "./routes/groups";
import { usersRoutes } from "./routes/users";
import { logsRoutes, addLog } from "./routes/logs";
import { authRoutes } from "./routes/auth";
import { authMiddleware } from "./middleware/auth.middleware";
import { setDashboardLogHandler } from "../core/logger/logger.service";

export class DashboardServer {
    private fastify: any;
    private port: number;
    private host: string;

    constructor(port?: number, host: string = "0.0.0.0") {
        this.port = port || parseInt(process.env.DASHBOARD_PORT || "3000");
        this.host = host;
        this.fastify = Fastify({
            logger: false, 
        });

        this.setupPlugins();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupLoggerIntegration();
    }

    private setupLoggerIntegration() {
        setDashboardLogHandler(addLog);
    }

    private setupMiddleware() {
        this.fastify.addHook("onRequest", authMiddleware);
    }

    private async setupPlugins() {
        // CORS
        await this.fastify.register(fastifyCors, {
            origin: true,
        });

        // Static files
        await this.fastify.register(fastifyStatic, {
            root: path.join(process.cwd(), "public"),
            prefix: "/",
        });
    }

    private setupRoutes() {
        // Health check
        this.fastify.get("/api/health", async () => {
            return { status: "ok", timestamp: new Date().toISOString() };
        });

        // Register API routes
        this.fastify.register(authRoutes, { prefix: "/api/auth" });
        this.fastify.register(statsRoutes, { prefix: "/api/stats" });
        this.fastify.register(groupsRoutes, { prefix: "/api/groups" });
        this.fastify.register(usersRoutes, { prefix: "/api/users" });
        this.fastify.register(logsRoutes, { prefix: "/api/logs" });
    }

    public async start() {
        try {
            await this.fastify.listen({ port: this.port, host: this.host });
        } catch (err) {
            console.error("Failed to start dashboard server:", err);
            process.exit(1);
        }
    }

    public getInstance() {
        return this.fastify;
    }
}
