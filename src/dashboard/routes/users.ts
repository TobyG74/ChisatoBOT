import { FastifyInstance } from "fastify";
import { Database } from "../../infrastructure/database";

export async function usersRoutes(fastify: FastifyInstance) {
    // Get all users
    fastify.get("/", async (request, reply) => {
        try {
            const {
                page = 1,
                limit = 10,
                role,
                search = "",
                banned,
            } = request.query as {
                page?: number;
                limit?: number;
                role?: string;
                search?: string;
                banned?: string;
            };

            const skip = (Number(page) - 1) * Number(limit);

            const where: any = {};
            if (role) where.role = role;
            if (banned === "banned") where.isBanned = true;
            if (banned === "active") where.isBanned = false;
            if (search) {
                where.OR = [
                    {
                        userId: {
                            contains: search,
                            mode: "insensitive" as const,
                        },
                    },
                    {
                        name: {
                            contains: search,
                            mode: "insensitive" as const,
                        },
                    },
                ];
            }

            const [users, total] = await Promise.all([
                Database.user.findMany({
                    where,
                    skip,
                    take: Number(limit),
                    select: {
                        userId: true,
                        name: true,
                        limit: true,
                        role: true,
                        expired: true,
                        isBanned: true,
                        afk: true,
                    },
                }),
                Database.user.count({ where }),
            ]);

            return {
                users: users.map((u) => ({
                    ...u,
                    isExpired: u.expired > 0 && u.expired < Date.now(),
                    expiresAt:
                        u.expired > 0
                            ? new Date(u.expired).toISOString()
                            : null,
                    afkSince:
                        u.afk.since && u.afk.since > 0
                            ? new Date(u.afk.since).toISOString()
                            : null,
                })),
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)),
                },
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch users" });
        }
    });

    // Get single user details
    fastify.get("/:userId", async (request, reply) => {
        try {
            const { userId } = request.params as { userId: string };

            const user = await Database.user.findUnique({
                where: { userId },
            });

            if (!user) {
                return reply.status(404).send({ error: "User not found" });
            }

            return {
                ...user,
                isExpired: user.expired > 0 && user.expired < Date.now(),
                expiresAt:
                    user.expired > 0
                        ? new Date(user.expired).toISOString()
                        : null,
                afkSince:
                    user.afk.since && user.afk.since > 0
                        ? new Date(user.afk.since).toISOString()
                        : null,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch user" });
        }
    });

    // Get premium users
    fastify.get("/premium/list", async (request, reply) => {
        try {
            const users = await Database.user.findMany({
                where: { role: "premium" },
                select: {
                    userId: true,
                    name: true,
                    expired: true,
                    limit: true,
                },
            });

            return {
                total: users.length,
                users: users.map((u) => ({
                    ...u,
                    isExpired: u.expired > 0 && u.expired < Date.now(),
                    expiresAt:
                        u.expired > 0
                            ? new Date(u.expired).toISOString()
                            : null,
                })),
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch premium users" });
        }
    });

    // Get AFK users
    fastify.get("/afk/list", async (request, reply) => {
        try {
            const allUsers = await Database.user.findMany({
                select: {
                    userId: true,
                    name: true,
                    afk: true,
                },
            });

            const users = allUsers.filter((u) => u.afk.status === true);

            return {
                total: users.length,
                users: users.map((u) => ({
                    userId: u.userId,
                    name: u.name,
                    reason: u.afk.reason,
                    since:
                        u.afk.since && u.afk.since > 0
                            ? new Date(u.afk.since).toISOString()
                            : null,
                })),
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch AFK users" });
        }
    });

    // Get banned users
    fastify.get("/banned/list", async (request, reply) => {
        try {
            const users = await Database.user.findMany({
                where: { isBanned: true },
                select: {
                    userId: true,
                    name: true,
                    isBanned: true,
                },
            });

            return {
                total: users.length,
                users: users.map((u) => ({
                    userId: u.userId,
                    name: u.name,
                    isBanned: u.isBanned,
                })),
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch banned users" });
        }
    });

    // Get users statistics
    fastify.get("/stats/summary", async (request, reply) => {
        try {
            const users = await Database.user.findMany({
                select: {
                    role: true,
                    limit: true,
                    expired: true,
                    afk: true,
                },
            });

            const now = Date.now();
            const stats = {
                totalUsers: users.length,
                byRole: {
                    free: users.filter((u) => u.role === "free").length,
                    premium: users.filter((u) => u.role === "premium").length,
                },
                premium: {
                    active: users.filter(
                        (u) =>
                            u.role === "premium" &&
                            (u.expired === 0 || u.expired > now)
                    ).length,
                    expired: users.filter(
                        (u) =>
                            u.role === "premium" &&
                            u.expired > 0 &&
                            u.expired < now
                    ).length,
                },
                afk: {
                    total: users.filter((u) => u.afk.status).length,
                },
                limits: {
                    average:
                        users.reduce((sum, u) => sum + u.limit, 0) /
                            users.length || 0,
                    max: Math.max(...users.map((u) => u.limit)),
                    min: Math.min(...users.map((u) => u.limit)),
                },
            };

            return stats;
        } catch (error) {
            reply.status(500).send({ error: "Failed to fetch statistics" });
        }
    });

    // Create new user
    fastify.post("/", async (request, reply) => {
        try {
            const { userId, name, role, limit, expired } = request.body as {
                userId: string;
                name?: string;
                role?: "free" | "premium";
                limit?: number;
                expired?: number;
            };

            if (!userId) {
                return reply.status(400).send({ error: "userId is required" });
            }

            const existingUser = await Database.user.findUnique({
                where: { userId },
            });

            if (existingUser) {
                return reply.status(409).send({ error: "User already exists" });
            }

            const user = await Database.user.create({
                data: {
                    userId,
                    name: name || "",
                    role: role || "free",
                    limit: limit || 20,
                    expired: expired || 0,
                    afk: {
                        status: false,
                        reason: "",
                        since: 0,
                    },
                    level: {
                        level: 1,
                        xp: 0,
                        totalXp: 0,
                    },
                    stats: {
                        totalCommands: 0,
                        commandsUsed: [],
                        lastCommandTime: 0,
                        joinedAt: Math.floor(Date.now() / 1000),
                    },
                },
            });

            return {
                success: true,
                message: "User created successfully",
                user,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to create user" });
        }
    });

    // Update user
    fastify.put("/:userId", async (request, reply) => {
        try {
            const { userId } = request.params as { userId: string };
            const { name, role, limit, expired } = request.body as {
                name?: string;
                role?: "free" | "premium";
                limit?: number;
                expired?: number;
            };

            const existingUser = await Database.user.findUnique({
                where: { userId },
            });

            if (!existingUser) {
                return reply.status(404).send({ error: "User not found" });
            }

            const updateData: any = {};
            if (name !== undefined) updateData.name = name;
            if (role !== undefined) updateData.role = role;
            if (limit !== undefined) updateData.limit = limit;
            if (expired !== undefined) updateData.expired = expired;

            const user = await Database.user.update({
                where: { userId },
                data: updateData,
            });

            return {
                success: true,
                message: "User updated successfully",
                user,
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to update user" });
        }
    });

    // Delete user
    fastify.delete("/:userId", async (request, reply) => {
        try {
            const { userId } = request.params as { userId: string };

            const existingUser = await Database.user.findUnique({
                where: { userId },
            });

            if (!existingUser) {
                return reply.status(404).send({ error: "User not found" });
            }

            await Database.user.delete({
                where: { userId },
            });

            return {
                success: true,
                message: "User deleted successfully",
            };
        } catch (error) {
            reply.status(500).send({ error: "Failed to delete user" });
        }
    });
}
