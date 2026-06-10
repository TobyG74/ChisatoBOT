import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import { statsRoutes } from "./routes/stats";
import { groupsRoutes } from "./routes/groups";
import { usersRoutes } from "./routes/users";
import { logsRoutes, addLog } from "./routes/logs";
import { authRoutes } from "./routes/auth";
import { groupAuthRoutes } from "./routes/group-auth";
import { groupAdminRoutes } from "./routes/group-admin";
import { configRoutes } from "./routes/config";
import { changelogRoutes } from "./routes/changelog";
import { authMiddleware } from "./middleware/auth.middleware";
import { setDashboardLogHandler } from "../core/logger/logger.service";
import { ipSecurityService } from "./services/ip-security.service";
import { Database } from "../infrastructure/database";

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
            setHeaders(res: any, filePath: string) {
                if (filePath.endsWith(".html")) {
                    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                    res.setHeader("Pragma", "no-cache");
                    res.setHeader("Expires", "0");
                } else if (filePath.endsWith(".js") || filePath.endsWith(".css")) {
                    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
                    res.setHeader("Pragma", "no-cache");
                    res.setHeader("Expires", "0");
                } else {
                    res.setHeader("Cache-Control", "no-cache");
                }
            },
        });
    }

    private setupRoutes() {
        // Health check
        this.fastify.get("/api/health", async () => {
            return { status: "ok", timestamp: new Date().toISOString() };
        });

        // Register API routes
        this.fastify.register(authRoutes, { prefix: "/api/auth" });
        this.fastify.register(groupAuthRoutes, { prefix: "/api/group-auth" });
        this.fastify.register(groupAdminRoutes, { prefix: "/api/group-admin" });
        this.fastify.register(statsRoutes, { prefix: "/api/stats" });
        this.fastify.register(groupsRoutes, { prefix: "/api/groups" });
        this.fastify.register(usersRoutes, { prefix: "/api/users" });
        this.fastify.register(logsRoutes, { prefix: "/api/logs" });
        this.fastify.register(configRoutes, { prefix: "/api/config" });
        this.fastify.register(changelogRoutes, { prefix: "/api/changelog" });

        // SPA fallback: the Svelte app uses clean history-mode URLs
        // (/login, /dashboard, /group-admin). Any non-API GET that doesn't map
        // to a real static file returns index.html so deep links and page
        // refreshes load the app instead of 404ing.
        this.fastify.setNotFoundHandler((request: any, reply: any) => {
            if (request.method === "GET" && !request.url.startsWith("/api/")) {
                return reply.sendFile("index.html");
            }
            return reply.status(404).send({ success: false, message: "Not found" });
        });
    }

    public async start() {
        try {
            await ipSecurityService.init(Database);
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
