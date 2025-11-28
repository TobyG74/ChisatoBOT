import { PrismaClient } from "@prisma/client";
import { cacheService } from "../../core/cache/cache.service";
import { logger } from "../../core/logger/logger.service";

// Prisma types
type PrismaUser = Awaited<ReturnType<PrismaClient["user"]["findUnique"]>>;
type PrismaGroup = Awaited<ReturnType<PrismaClient["group"]["findUnique"]>>;

class DatabaseService {
    private static instance: DatabaseService;
    private prisma: PrismaClient;
    private readonly CACHE_TTL = {
        USER: 5 * 60 * 1000, // 5 minutes
        GROUP: 10 * 60 * 1000, // 10 minutes
        SETTINGS: 15 * 60 * 1000, // 15 minutes
    };

    private constructor() {
        this.prisma = new PrismaClient({
            log: ["error"],
        });
        this.initializeConnection();
    }

    public static getInstance(): DatabaseService {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }

    private async initializeConnection(): Promise<void> {
        try {
            await this.prisma.$connect();
            logger.info("Database connected successfully");
        } catch (error) {
            logger.error(
                `Database connection failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            throw error;
        }
    }

    public getPrismaClient(): PrismaClient {
        return this.prisma;
    }

    /**
     * User Operations
     */
    public async getUser(userId: string): Promise<PrismaUser | null> {
        const cacheKey = `user:${userId}`;

        return cacheService.getOrSet(
            cacheKey,
            () => this.prisma.user.findUnique({ where: { userId } }),
            this.CACHE_TTL.USER
        );
    }

    public async upsertUser(
        userId: string,
        name?: string
    ): Promise<PrismaUser> {
        const cacheKey = `user:${userId}`;

        const user = await this.prisma.user.upsert({
            where: { userId },
            create: {
                userId,
                name: name || null,
                limit: 30,
                role: "free",
                expired: 0,
                afk: {
                    status: false,
                    reason: null,
                    since: 0,
                },
            },
            update: {
                name: name || undefined,
            },
        });

        cacheService.set(cacheKey, user, this.CACHE_TTL.USER);
        return user;
    }

    public async updateUser(userId: string, data: any): Promise<PrismaUser> {
        const cacheKey = `user:${userId}`;

        const user = await this.prisma.user.upsert({
            where: { userId },
            create: {
                userId,
                name: data.name || null,
                limit: data.limit || 30,
                role: data.role || "free",
                expired: data.expired || 0,
                afk: data.afk || {
                    status: false,
                    reason: null,
                    since: 0,
                },
            },
            update: data,
        });

        cacheService.set(cacheKey, user, this.CACHE_TTL.USER);
        return user;
    }

    public async getUserCount(): Promise<number> {
        return this.prisma.user.count();
    }

    /**
     * Group Operations
     */
    public async getGroup(groupId: string): Promise<PrismaGroup | null> {
        const cacheKey = `group:${groupId}`;

        return cacheService.getOrSet(
            cacheKey,
            () => this.prisma.group.findUnique({ where: { groupId } }),
            this.CACHE_TTL.GROUP
        );
    }

    public async upsertGroup(
        groupId: string,
        groupData: any
    ): Promise<PrismaGroup> {
        const cacheKey = `group:${groupId}`;

        const settings = groupData.settings || {};
        settings.antilink = settings.antilink || {};
        
        const validData: any = {
            subject: groupData.subject || "",
            subjectOwnerPn: groupData.subjectOwnerPn || null,
            addressingMode: groupData.addressingMode || null,
            size: groupData.size || groupData.participants?.length || 0,
            creation: groupData.creation || 0,
            owner: groupData.owner || null,
            ownerPn: groupData.ownerPn || null,
            owner_country_code: groupData.owner_country_code || null,
            desc: groupData.desc || null,
            descOwner: groupData.descOwner || null,
            descOwnerPn: groupData.descOwnerPn || null,
            descTime: groupData.descTime || null,
            linkedParent: groupData.linkedParent || null,
            joinApprovalMode: groupData.joinApprovalMode || false,
            restrict: groupData.restrict || false,
            announce: groupData.announce || false,
            isCommunity: groupData.isCommunity || false,
            isCommunityAnnounce: groupData.isCommunityAnnounce || false,
            memberAddMode: groupData.memberAddMode ?? true,
            participants: groupData.participants || [],
            ephemeralDuration: groupData.ephemeralDuration || 0,
            settings: {
                notify: settings.notify ?? false,
                welcome: settings.welcome ?? true,
                leave: settings.leave ?? true,
                mute: settings.mute ?? false,
                antilink: {
                    status: settings.antilink.status ?? false,
                    mode: settings.antilink.mode || "kick",
                    list: settings.antilink.list || ["whatsapp"]
                },
                antibot: settings.antibot ?? false,
                banned: settings.banned || []
            }
        };

        const group = await this.prisma.group.upsert({
            where: { groupId },
            create: { groupId, ...validData },
            update: validData,
        });

        cacheService.set(cacheKey, group, this.CACHE_TTL.GROUP);
        return group;
    }

    public async updateGroup(groupId: string, data: any): Promise<PrismaGroup> {
        const cacheKey = `group:${groupId}`;

        const payload = data?.groupMetadata ?? data;

        const group = await this.upsertGroup(groupId, payload);

        cacheService.set(cacheKey, group, this.CACHE_TTL.GROUP);
        return group;
    }

    public async updateGroupSettings(
        groupId: string,
        settings: any
    ): Promise<PrismaGroup> {
        const cacheKey = `group:${groupId}`;

        const group = await this.prisma.group.update({
            where: { groupId },
            data: {
                settings: {
                    update: settings,
                },
            },
        });

        cacheService.set(cacheKey, group, this.CACHE_TTL.GROUP);
        return group;
    }

    public async deleteGroup(groupId: string): Promise<PrismaGroup> {
        const cacheKey = `group:${groupId}`;

        const group = await this.prisma.group.delete({
            where: { groupId },
        });

        cacheService.delete(cacheKey);
        return group;
    }

    public async getGroupCount(): Promise<number> {
        return this.prisma.group.count();
    }

    public async getAllGroups(): Promise<PrismaGroup[]> {
        return this.prisma.group.findMany();
    }

    /**
     * Batch Operations for Performance
     */
    public async batchUpdateUsers(
        updates: Array<{ userId: string; data: any }>
    ): Promise<void> {
        for (const { userId, data } of updates) {
            const cacheKey = `user:${userId}`;
            cacheService.delete(cacheKey);
            await this.prisma.user.update({ where: { userId }, data });
        }
    }

    /**
     * Reset daily limits
     */
    public async resetUserLimits(limit: number): Promise<void> {
        await this.prisma.user.updateMany({
            where: {
                userId: {
                    contains: "@s.whatsapp.net",
                },
                role: {
                    in: ["free"],
                },
            },
            data: {
                limit,
            },
        });

        logger.info("User limits reset, clearing user cache");
    }

    /**
     * Cleanup and disconnect
     */
    public async disconnect(): Promise<void> {
        await this.prisma.$disconnect();
        logger.info("Database disconnected");
    }
}

export const databaseService = DatabaseService.getInstance();
export const Database = databaseService.getPrismaClient();
