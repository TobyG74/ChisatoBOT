import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { configService } from "../../core/config/config.service";
import type { CommandOverride } from "../../core/config/config.service";
import { verifyToken } from "./auth";
import path from "path";
import fs from "fs";

function requireOwner(request: FastifyRequest, reply: FastifyReply): boolean {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ success: false, message: "Unauthorized" });
        return false;
    }
    const decoded = verifyToken(authHeader.substring(7)) as any;
    if (!decoded || decoded.role !== "owner") {
        reply.status(403).send({ success: false, message: "Owner only" });
        return false;
    }
    return true;
}

function getCommandList(): string[] {
    const commandsDir = path.join(process.cwd(), "src", "commands");
    const commands: string[] = [];

    function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanDir(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
                try {
                    // Extract command name from filename (strip extension)
                    const name = entry.name.replace(/\.(ts|js)$/, "");
                    commands.push(name);
                } catch {
                    // skip
                }
            }
        }
    }

    scanDir(commandsDir);
    return [...new Set(commands)].sort();
}

export async function configRoutes(fastify: FastifyInstance) {

    // GET /api/config — return full config (owner only)
    fastify.get("/", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const config = configService.getConfig();
            return reply.send({ success: true, config });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // PATCH /api/config/settings — update boolean settings
    fastify.patch("/settings", async (request: FastifyRequest<{ Body: any }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const allowed = ["ownerNotifyOnline", "useLimit", "useCooldown", "selfbot", "autoReadMessage", "autoReadStatus", "autoCorrect"];
            const updates: any = {};
            for (const key of allowed) {
                if (typeof request.body[key] === "boolean") {
                    updates[key] = request.body[key];
                }
            }
            configService.updateSettings(updates);
            return reply.send({ success: true, message: "Settings updated", settings: configService.getConfig().settings });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // PATCH /api/config/general — update prefix, timezone, limit, stickers
    fastify.patch("/general", async (request: FastifyRequest<{ Body: any }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const body = request.body as any;
            const updates: any = {};
            if (typeof body.prefix === "string" && body.prefix.trim()) updates.prefix = body.prefix.trim();
            if (typeof body.timeZone === "string" && body.timeZone.trim()) updates.timeZone = body.timeZone.trim();
            if (body.limit?.command !== undefined) updates.limit = { command: Number(body.limit.command) };
            if (body.stickers) {
                updates.stickers = {
                    author: String(body.stickers.author || ""),
                    packname: String(body.stickers.packname || ""),
                };
            }
            if (body.call?.status) updates.call = { status: String(body.call.status) };
            configService.updateConfig(updates);
            return reply.send({ success: true, message: "Config updated", config: configService.getConfig() });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // GET /api/config/maintenance — list maintenance commands
    fastify.get("/maintenance", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const config = configService.getConfig();
            const allCommands = getCommandList();
            return reply.send({
                success: true,
                maintenance: config.maintenance,
                allCommands,
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/maintenance — add command to maintenance
    fastify.post("/maintenance", async (request: FastifyRequest<{ Body: { command: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { command } = request.body;
            if (!command?.trim()) return reply.status(400).send({ success: false, message: "Command required" });
            configService.addMaintenance(command.trim());
            return reply.send({ success: true, message: `${command} added to maintenance`, maintenance: configService.getConfig().maintenance });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/maintenance/:command — remove from maintenance
    fastify.delete("/maintenance/:command", async (request: FastifyRequest<{ Params: { command: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { command } = request.params;
            configService.removeMaintenance(command);
            return reply.send({ success: true, message: `${command} removed from maintenance`, maintenance: configService.getConfig().maintenance });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/maintenance/clear — clear all maintenance
    fastify.post("/maintenance/clear", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const config = configService.getConfig();
            for (const cmd of [...config.maintenance]) {
                configService.removeMaintenance(cmd);
            }
            return reply.send({ success: true, message: "All maintenance cleared", maintenance: [] });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // GET /api/config/commands — list all commands with their overrides
    fastify.get("/commands", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const overrides = configService.getAllCommandOverrides();
            // Load commands from dist (same as CommandLoader does)
            const distDir = path.join(process.cwd(), "dist", "commands");
            const commandsData: any[] = [];

            function scanDist(dir: string, category: string = "") {
                if (!fs.existsSync(dir)) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        scanDist(fullPath, entry.name);
                    } else if (entry.name.endsWith(".js")) {
                        try {
                            delete require.cache[require.resolve(fullPath)];
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            const mod = require(fullPath);
                            const cmd = mod.default;
                            if (cmd && cmd.name) {
                                const name = cmd.name;
                                commandsData.push({
                                    name,
                                    category: cmd.category || category,
                                    description: cmd.description || "",
                                    alias: cmd.alias || [],
                                    cooldown: cmd.cooldown ?? null,
                                    limit: cmd.limit ?? null,
                                    isOwner: cmd.isOwner ?? false,
                                    isTeam: cmd.isTeam ?? false,
                                    isPrivate: cmd.isPrivate ?? false,
                                    isPremium: cmd.isPremium ?? false,
                                    isGroup: cmd.isGroup ?? false,
                                    isGroupAdmin: cmd.isGroupAdmin ?? false,
                                    isGroupOwner: cmd.isGroupOwner ?? false,
                                    isBotAdmin: cmd.isBotAdmin ?? false,
                                    override: overrides[name] || null,
                                });
                            }
                        } catch { /* skip broken files */ }
                    }
                }
            }

            scanDist(distDir);
            commandsData.sort((a, b) => a.name.localeCompare(b.name));
            return reply.send({ success: true, commands: commandsData });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // PATCH /api/config/commands/:name — update override for a command
    fastify.patch("/commands/:name", async (request: FastifyRequest<{ Params: { name: string }; Body: any }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { name } = request.params;
            const body = request.body as Record<string, unknown>;
            const allowed: (keyof CommandOverride)[] = ["isOwner", "isTeam", "isPrivate", "isPremium", "isGroup", "isGroupAdmin", "isGroupOwner", "isBotAdmin", "cooldown", "limit"];
            const override: CommandOverride = {};
            for (const key of allowed) {
                if (key in body) {
                    if ((key === "cooldown" || key === "limit") && body[key] !== null) {
                        (override as any)[key] = Number(body[key]);
                    } else if (key === "cooldown" || key === "limit") {
                        (override as any)[key] = undefined;
                    } else {
                        (override as any)[key] = Boolean(body[key]);
                    }
                }
            }
            if (Object.keys(override).length === 0) {
                return reply.status(400).send({ success: false, message: "No valid fields to update" });
            }
            configService.setCommandOverride(name, override);
            return reply.send({ success: true, message: `Override saved for ${name}`, override: configService.getCommandOverride(name) });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/commands/:name/override — reset command override
    fastify.delete("/commands/:name/override", async (request: FastifyRequest<{ Params: { name: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { name } = request.params;
            configService.clearCommandOverride(name);
            return reply.send({ success: true, message: `Override cleared for ${name}` });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });
}
