import { FastifyInstance } from "fastify";
import { Database } from "../../infrastructure/database";
import os from "os";

export async function statsRoutes(fastify: FastifyInstance) {
    // Get overall statistics
    fastify.get("/", async (request, reply) => {
        try {
            const [totalUsers, totalGroups, premiumUsers, bannedUsers, groups] =
                await Promise.all([
                    Database.user.count(),
                    Database.group.count(),
                    Database.user.count({ where: { role: "premium" } }),
                    Database.user.count({ where: { isBanned: true } }),
                    Database.group.findMany({
                        select: {
                            participants: true,
                        },
                    }),
                ]);

            // Calculate uptime
            const uptime = process.uptime();
            const uptimeString = formatUptime(uptime);

            // Calculate total participants across all groups
            const totalParticipants = groups.reduce(
                (sum, group) => sum + (group.participants?.length || 0),
                0
            );

            // Get active groups (groups with settings enabled)
            const activeGroups = groups.filter(
                (g) => g.participants && g.participants.length > 0
            ).length;

            return {
                totalUsers,
                totalGroups,
                activeGroups,
                premiumUsers,
                bannedUsers,
                totalParticipants,
                uptime: uptimeString,
                uptimeSeconds: Math.floor(uptime),
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch statistics" });
        }
    });

    // Get users and groups growth over time
    fastify.get("/growth", async (request, reply) => {
        try {
            const [users, groups] = await Promise.all([
                Database.user.findMany({
                    select: {
                        userId: true,
                        role: true,
                        limit: true,
                    },
                }),
                Database.group.findMany({
                    select: {
                        groupId: true,
                        subject: true,
                        size: true,
                        settings: true,
                    },
                }),
            ]);

            const roleStats = users.reduce((acc, user) => {
                acc[user.role] = (acc[user.role] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const settingsStats = {
                antilink: 0,
                antibot: 0,
                welcome: 0,
                notify: 0,
                mute: 0,
            };

            groups.forEach((group) => {
                if (group.settings.antilink?.status) settingsStats.antilink++;
                if (group.settings.antibot) settingsStats.antibot++;
                if (group.settings.welcome) settingsStats.welcome++;
                if (group.settings.notify) settingsStats.notify++;
                if (group.settings.mute) settingsStats.mute++;
            });

            return {
                users: {
                    total: users.length,
                    byRole: roleStats,
                },
                groups: {
                    total: groups.length,
                    settingsEnabled: settingsStats,
                },
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch growth data" });
        }
    });

    // Get memory usage
    fastify.get("/system", async (request, reply) => {
        try {
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memPct = Math.round((usedMem / totalMem) * 100);
            return {
                memory: {
                    rss: formatBytes(memoryUsage.rss),
                    heapTotal: formatBytes(memoryUsage.heapTotal),
                    heapUsed: formatBytes(memoryUsage.heapUsed),
                    external: formatBytes(memoryUsage.external),
                    rssBytes: memoryUsage.rss,
                    heapTotalBytes: memoryUsage.heapTotal,
                    heapUsedBytes: memoryUsage.heapUsed,
                    externalBytes: memoryUsage.external,
                },
                os: {
                    totalMem: formatBytes(totalMem),
                    freeMem: formatBytes(freeMem),
                    usedMem: formatBytes(usedMem),
                    totalMemBytes: totalMem,
                    usedMemBytes: usedMem,
                    memPct,
                },
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid,
                uptimeSeconds: Math.floor(uptime),
                uptime: formatUptime(uptime),
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch system info" });
        }
    });

    // Real-time SSE stream — pushes system data every 1 second
    fastify.get("/stream", async (request, reply) => {
        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        });
        reply.raw.flushHeaders();

        const sendData = () => {
            try {
                const uptime = process.uptime();
                const memoryUsage = process.memoryUsage();
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                const memPct = Math.round((usedMem / totalMem) * 100);
                const data = {
                    memory: {
                        rss: formatBytes(memoryUsage.rss),
                        heapTotal: formatBytes(memoryUsage.heapTotal),
                        heapUsed: formatBytes(memoryUsage.heapUsed),
                        external: formatBytes(memoryUsage.external),
                        rssBytes: memoryUsage.rss,
                        heapTotalBytes: memoryUsage.heapTotal,
                        heapUsedBytes: memoryUsage.heapUsed,
                        externalBytes: memoryUsage.external,
                    },
                    os: {
                        totalMem: formatBytes(totalMem),
                        freeMem: formatBytes(freeMem),
                        usedMem: formatBytes(usedMem),
                        totalMemBytes: totalMem,
                        usedMemBytes: usedMem,
                        memPct,
                    },
                    uptimeSeconds: Math.floor(uptime),
                    platform: process.platform,
                    nodeVersion: process.version,
                    pid: process.pid,
                };
                reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch { /* client disconnected */ }
        };

        sendData();
        const interval = setInterval(sendData, 1000);

        await new Promise<void>((resolve) => {
            request.raw.on("close", () => { clearInterval(interval); resolve(); });
            request.raw.on("error", () => { clearInterval(interval); resolve(); });
        });
    });
}

// Helper functions
function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(" ");
}

function formatBytes(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}
