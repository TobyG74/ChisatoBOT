import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { configService } from "../../core/config/config.service";
import type { CommandOverride } from "../../core/config/config.service";
import { verifyToken } from "./auth";
import { ipSecurityService } from "../services/ip-security.service";
import path from "path";
import { pathToFileURL } from "url";
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

function requireOwnerOrTeam(request: FastifyRequest, reply: FastifyReply): boolean {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ success: false, message: "Unauthorized" });
        return false;
    }
    const decoded = verifyToken(authHeader.substring(7)) as any;
    if (!decoded || (decoded.role !== "owner" && decoded.role !== "team")) {
        reply.status(403).send({ success: false, message: "Owner or team only" });
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

    // GET /api/config — return full config (owner or team)
    fastify.get("/", async (request, reply) => {
        if (!requireOwnerOrTeam(request, reply)) return;
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

    // GET /api/config/maintenance — list maintenance commands (owner or team)
    fastify.get("/maintenance", async (request, reply) => {
        if (!requireOwnerOrTeam(request, reply)) return;
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

    // GET /api/config/commands — list all commands with their overrides (owner or team)
    fastify.get("/commands", async (request, reply) => {
        if (!requireOwnerOrTeam(request, reply)) return;
        try {
            const overrides = configService.getAllCommandOverrides();
            // Load commands from dist (same as CommandLoader does)
            const distDir = path.join(process.cwd(), "dist", "commands");
            const commandsData: any[] = [];

            async function scanDist(dir: string, category: string = "") {
                if (!fs.existsSync(dir)) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await scanDist(fullPath, entry.name);
                    } else if (entry.name.endsWith(".js")) {
                        try {
                            const mod = await import(pathToFileURL(fullPath).href);
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

            await scanDist(distDir);
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

    // GET /api/config/ip — return current whitelist and blacklist (role-tagged)
    fastify.get("/ip", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/ip/whitelist — add IP to whitelist (with optional role)
    fastify.post("/ip/whitelist", async (request: FastifyRequest<{ Body: { ip: string; role?: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { ip, role } = request.body;
            if (!ip?.trim()) return reply.status(400).send({ success: false, message: "IP required" });
            const safeRole: "owner" | "team" | "unknown" =
                role === "owner" || role === "team" ? role : "unknown";
            await ipSecurityService.addToWhitelist(ip.trim(), safeRole);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // PUT /api/config/ip/whitelist/:ip — edit an existing whitelist entry
    fastify.put("/ip/whitelist/:ip", async (request: FastifyRequest<{ Params: { ip: string }; Body: { ip?: string; role?: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const originalIp = decodeURIComponent(request.params.ip);
            const newIp = (request.body?.ip ?? originalIp).trim();
            const role = request.body?.role;
            const safeRole: "owner" | "team" | "unknown" =
                role === "owner" || role === "team" ? role : "unknown";
            if (!newIp) return reply.status(400).send({ success: false, message: "IP required" });
            await ipSecurityService.updateWhitelistEntry(originalIp, newIp, safeRole);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(400).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/ip/whitelist/:ip — remove IP from whitelist
    fastify.delete("/ip/whitelist/:ip", async (request: FastifyRequest<{ Params: { ip: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const ip = decodeURIComponent(request.params.ip);
            await ipSecurityService.removeFromWhitelist(ip);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/ip/blacklist — add IP to blacklist (with optional role)
    fastify.post("/ip/blacklist", async (request: FastifyRequest<{ Body: { ip: string; role?: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { ip, role } = request.body;
            if (!ip?.trim()) return reply.status(400).send({ success: false, message: "IP required" });
            const safeRole: "owner" | "team" | "unknown" =
                role === "owner" || role === "team" ? role : "unknown";
            await ipSecurityService.addToBlacklist(ip.trim(), safeRole);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // PUT /api/config/ip/blacklist/:ip — edit an existing blacklist entry
    fastify.put("/ip/blacklist/:ip", async (request: FastifyRequest<{ Params: { ip: string }; Body: { ip?: string; role?: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const originalIp = decodeURIComponent(request.params.ip);
            const newIp = (request.body?.ip ?? originalIp).trim();
            const role = request.body?.role;
            const safeRole: "owner" | "team" | "unknown" =
                role === "owner" || role === "team" ? role : "unknown";
            if (!newIp) return reply.status(400).send({ success: false, message: "IP required" });
            await ipSecurityService.updateBlacklistEntry(originalIp, newIp, safeRole);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(400).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/ip/blacklist/:ip — remove IP from blacklist
    fastify.delete("/ip/blacklist/:ip", async (request: FastifyRequest<{ Params: { ip: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const ip = decodeURIComponent(request.params.ip);
            await ipSecurityService.removeFromBlacklist(ip);
            return reply.send({
                success: true,
                ...ipSecurityService.getLists(),
                grouped: ipSecurityService.getListsByRole(),
            });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // GET /api/config/numbers — return ownerNumber and teamNumber
    fastify.get("/numbers", async (request, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const config = configService.getConfig();
            return reply.send({ success: true, ownerNumber: config.ownerNumber ?? [], teamNumber: config.teamNumber ?? [] });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/numbers/owner — add a number to ownerNumber
    fastify.post("/numbers/owner", async (request: FastifyRequest<{ Body: { number: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { number } = request.body;
            if (!number?.trim()) return reply.status(400).send({ success: false, message: "Number required" });
            const clean = number.trim().replace(/\D/g, "");
            if (!clean || clean.length < 8) return reply.status(400).send({ success: false, message: "Invalid phone number" });
            const config = configService.getConfig();
            const ownerNumber = [...(config.ownerNumber ?? [])];
            if (!ownerNumber.includes(clean)) {
                ownerNumber.push(clean);
                configService.updateConfig({ ownerNumber });
            }
            const updated = configService.getConfig();
            return reply.send({ success: true, ownerNumber: updated.ownerNumber, teamNumber: updated.teamNumber });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/numbers/owner/:number — remove from ownerNumber
    fastify.delete("/numbers/owner/:number", async (request: FastifyRequest<{ Params: { number: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const num = decodeURIComponent(request.params.number);
            const config = configService.getConfig();
            const ownerNumber = (config.ownerNumber ?? []).filter(n => n !== num);
            configService.updateConfig({ ownerNumber });
            const updated = configService.getConfig();
            return reply.send({ success: true, ownerNumber: updated.ownerNumber, teamNumber: updated.teamNumber });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // POST /api/config/numbers/team — add a number to teamNumber
    fastify.post("/numbers/team", async (request: FastifyRequest<{ Body: { number: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const { number } = request.body;
            if (!number?.trim()) return reply.status(400).send({ success: false, message: "Number required" });
            const clean = number.trim().replace(/\D/g, "");
            if (!clean || clean.length < 8) return reply.status(400).send({ success: false, message: "Invalid phone number" });
            const config = configService.getConfig();
            const teamNumber = [...(config.teamNumber ?? [])];
            if (!teamNumber.includes(clean)) {
                teamNumber.push(clean);
                configService.updateConfig({ teamNumber });
            }
            const updated = configService.getConfig();
            return reply.send({ success: true, ownerNumber: updated.ownerNumber, teamNumber: updated.teamNumber });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });

    // DELETE /api/config/numbers/team/:number — remove from teamNumber
    fastify.delete("/numbers/team/:number", async (request: FastifyRequest<{ Params: { number: string } }>, reply) => {
        if (!requireOwner(request, reply)) return;
        try {
            const num = decodeURIComponent(request.params.number);
            const config = configService.getConfig();
            const teamNumber = (config.teamNumber ?? []).filter(n => n !== num);
            configService.updateConfig({ teamNumber });
            const updated = configService.getConfig();
            return reply.send({ success: true, ownerNumber: updated.ownerNumber, teamNumber: updated.teamNumber });
        } catch (e: any) {
            return reply.status(500).send({ success: false, message: e.message });
        }
    });
}
